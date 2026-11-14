import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provision, nextAction, ExternalError, vercel, type HostingPort, type RegistryPort, type EnvVar } from './index.ts';

function fakes() {
  const state = { projects: new Map<string, string>(), env: [] as EnvVar[], domains: new Set<string>(), verified: false, creates: 0, failNext: null as null | { op: string; err: Error } };
  const maybeFail = (op: string) => { if (state.failNext?.op === op) { const e = state.failNext.err; state.failNext = null; throw e; } };
  const host: HostingPort = {
    async findProject(n) { const id = state.projects.get(n); return id ? { id } : null; },
    async createProject(p) { maybeFail('createProject'); state.creates++; const id = 'prj_' + state.creates; state.projects.set(p.name, id); return { id }; },
    async upsertEnv(_id, vars) { maybeFail('upsertEnv'); state.env = vars; },
    async addDomain(_id, d) { maybeFail('addDomain'); state.domains.add(d); return { verified: false, dns: [{ type: 'CNAME', name: d, value: 'cname.vercel-dns.com' }] }; },
    async verifyDomain() { maybeFail('verifyDomain'); return { verified: state.verified }; },
  };
  const steps = new Map<string, any>(); const creds: any[] = []; const audit: any[] = []; let revokes = 0; let storefront = 'draft';
  const reg: RegistryPort = {
    async getStep(r, s) { return steps.get(r + s) ?? null; }, async saveStep(r, s, v) { steps.set(r + s, { ...v, attempts: (steps.get(r + s)?.attempts ?? 0) + 1 }); },
    async createCredentials(_f, c) { creds.push(...c); }, async revokeCredentials() { revokes++; creds.length = 0; }, async setStorefrontState(_f, s) { storefront = s; }, async audit(e) { audit.push(e); },
  };
  return { state, host, reg, steps, creds, audit, get revokes() { return revokes; }, get storefront() { return storefront; } };
}
const input = { runId: 'run1', storeId: 'store_a', storefrontId: 'sf_a', env: 'production' as const, projectName: 'store-a-web', apiUrl: 'https://api.oss.test', siteUrl: 'https://a.example.com', domain: 'a.example.com' };

test('happy path provisions project, credentials, env, domain, then waits on DNS verification', async () => {
  const f = fakes(); const r1 = await provision(input, f.host, f.reg);
  assert.deepEqual(r1.map(s => s.status), ['done', 'done', 'done', 'failed']); assert.equal(nextAction(r1), 'retry'); assert.equal(f.storefront, 'draft');
  f.state.verified = true; const r2 = await provision(input, f.host, f.reg);
  assert.deepEqual(r2.map(s => s.status), ['skipped', 'skipped', 'skipped', 'done']); assert.equal(nextAction(r2), 'done'); assert.equal(f.storefront, 'connected'); assert.equal(f.state.creates, 1);
});
test('secrets go to the host as sensitive variables only; the ledger, audit and registry never hold plaintext', async () => {
  const f = fakes(); await provision({ ...input, domain: undefined }, f.host, f.reg);
  const sec = f.state.env.filter(v => v.sensitive); assert.deepEqual(sec.map(v => v.key).sort(), ['OSS_REVALIDATION_SECRET', 'OSS_STOREFRONT_SERVER_SECRET']);
  assert.notEqual(sec[0].value, sec[1].value); assert.ok(sec.every(v => v.value.length === 43)); assert.ok(f.state.env.filter(v => !v.sensitive).every(v => !/SECRET/.test(v.key)));
  const dump = JSON.stringify([[...f.steps.values()], f.audit, f.creds.map(c => ({ ...c, hash: c.hash.toString('hex') }))]);
  for (const v of sec) assert.ok(!dump.includes(v.value));
  assert.ok(f.creds.every(c => c.hash.length === 32 && c.expiresAt > new Date()));
});
test('a failure after the project exists is retried without creating a second project', async () => {
  const f = fakes(); f.state.failNext = { op: 'upsertEnv', err: new ExternalError('Vercel is unavailable', true) };
  const r1 = await provision({ ...input, domain: undefined }, f.host, f.reg); assert.equal(nextAction(r1), 'retry'); assert.equal(f.state.creates, 1);
  const r2 = await provision({ ...input, domain: undefined }, f.host, f.reg); assert.equal(nextAction(r2), 'done'); assert.equal(f.state.creates, 1); assert.equal(f.revokes, 2);      // credentials re-issued, old ones revoked
});
test('adopts a project created by an earlier half-finished run', async () => {
  const f = fakes(); f.state.projects.set('store-a-web', 'prj_existing'); await provision({ ...input, domain: undefined }, f.host, f.reg); assert.equal(f.state.creates, 0);
});
test('non-retryable failure is reported as needing a fix and stops the run', async () => {
  const f = fakes(); f.state.failNext = { op: 'createProject', err: new ExternalError('Vercel rejected the request (403)', false) };
  const r = await provision(input, f.host, f.reg); assert.equal(nextAction(r), 'fix'); assert.equal(r.length, 1);
});
test('unexpected errors do not leak their message', async () => {
  const f = fakes(); f.state.failNext = { op: 'createProject', err: new Error('token vcp_SECRET leaked in message') };
  const r = await provision(input, f.host, f.reg); assert.equal(r[0].message, 'Unexpected error'); assert.ok(!JSON.stringify(f.audit).includes('vcp_SECRET'));
});
test('environment targets: preview and staging never receive production targets', async () => {
  for (const [env, t] of [['preview', 'preview'], ['staging', 'preview'], ['development', 'development'], ['production', 'production']] as const) {
    const f = fakes(); await provision({ ...input, env, domain: undefined }, f.host, f.reg); assert.ok(f.state.env.every(v => v.targets.length === 1 && v.targets[0] === t), env);
  }
});
test('vercel adapter: 429 and 5xx are retryable, 4xx is not, bodies are not echoed, team scope is sent', async () => {
  const mk = (status: number, headers: Record<string, string> = {}) => { const urls: string[] = []; return { urls, h: vercel({ token: 't', teamId: 'team_1', fetch: (async (u: string) => { urls.push(u); return new Response('{"secret":"echo-me"}', { status, headers }); }) as any }) }; };
  const a = mk(429, { 'retry-after': '3' }); await assert.rejects(a.h.createProject({ name: 'x', framework: 'nextjs' }), (e: any) => e.retryable && e.retryAfterMs === 3000 && a.urls[0].includes('teamId=team_1'));
  await assert.rejects(mk(503).h.createProject({ name: 'x', framework: 'nextjs' }), (e: any) => e.retryable);
  await assert.rejects(mk(403).h.createProject({ name: 'x', framework: 'nextjs' }), (e: any) => !e.retryable && !/echo-me/.test(e.message));
  assert.equal(await mk(404).h.findProject('nope'), null);
});
