import { ExternalError, type HostingPort, type EnvVar } from './ports.ts';

/** Vercel REST adapter. Written from the public API reference; endpoint versions should be re-checked against a real team before first use.
 *  Limits (docs/limits, checked 2026): Hobby 200 projects / Pro and Enterprise unlimited; env vars 1000 per environment per project; 64 KB total. */
export function vercel(o: { token: string; teamId: string; fetch?: typeof fetch }): HostingPort {
  const f = o.fetch ?? fetch, base = 'https://api.vercel.com';
  async function api<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await f(`${base}${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(o.teamId)}`, { method, headers: { authorization: `Bearer ${o.token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 404) return null;
    if (res.status === 429) throw new ExternalError('Vercel rate limit', true, Number(res.headers.get('retry-after') ?? 1) * 1000);
    if (res.status >= 500) throw new ExternalError('Vercel is unavailable', true);
    if (!res.ok) throw new ExternalError(`Vercel rejected the request (${res.status})`, false);       // body deliberately not echoed: it can contain submitted values
    return (await res.json()) as T;
  }
  return {
    async findProject(name) { const p = await api<{ id: string }>('GET', `/v9/projects/${encodeURIComponent(name)}`); return p ? { id: p.id } : null; },
    async createProject(p) { const r = await api<{ id: string }>('POST', '/v11/projects', p); if (!r) throw new ExternalError('Project creation failed', false); return { id: r.id }; },
    async upsertEnv(id, vars: EnvVar[]) { await api('POST', `/v10/projects/${id}/env?upsert=true`, vars.map(v => ({ key: v.key, value: v.value, type: v.sensitive ? 'sensitive' : 'plain', target: v.targets }))); },
    async addDomain(id, domain) { const r = await api<{ verified: boolean; verification?: { type: string; domain: string; value: string }[] }>('POST', `/v10/projects/${id}/domains`, { name: domain }); return { verified: !!r?.verified, dns: (r?.verification ?? []).map(v => ({ type: v.type, name: v.domain, value: v.value })) }; },
    async verifyDomain(id, domain) { const r = await api<{ verified: boolean }>('POST', `/v9/projects/${id}/domains/${encodeURIComponent(domain)}/verify`); return { verified: !!r?.verified }; },
  };
}
