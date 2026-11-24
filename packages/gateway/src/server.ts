import http from 'node:http';
import { createGateway, type GatewayDeps } from './gateway.ts';
import { createContentGateway } from './content-gateway.ts';
import type { ContentStore, Upstream } from './ports.ts';

export const API_META = { apiVersion: 'v1', minSdk: '0.1.0' };
const MAX_BODY = 64 * 1024;

/** Real upstream: fetch with a hard timeout. Never follows redirects (a cell must not bounce a request elsewhere). */
export const fetchUpstream: Upstream = {
  async post(url, init) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), init.timeoutMs);
    try {
      const r = await fetch(url, { method: 'POST', headers: init.headers, body: init.body, signal: ac.signal, redirect: 'error' });
      const headers: Record<string, string> = {}; r.headers.forEach((v, k) => { headers[k] = v; });
      return { status: r.status, headers, body: await r.text() };
    } catch { return { status: 504, headers: {}, body: '{"error":"upstream timeout"}' }; } finally { clearTimeout(t); }
  },
};

export function createServer(deps: Omit<GatewayDeps, 'upstream'> & { upstream?: Upstream; content?: ContentStore }) {
  const handle = createGateway({ ...deps, upstream: deps.upstream ?? fetchUpstream });
  const content = deps.content ? createContentGateway({ registry: deps.registry, content: deps.content, rateLimit: deps.storefrontLimit, audit: deps.audit }) : null;
  return http.createServer(async (req, res) => {
    const send = (status: number, body: string, headers: Record<string, string> = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(body); };
    try {
      if (req.method === 'GET' && req.url === '/healthz') return send(200, '{"ok":true}');
      if (req.method === 'GET' && req.url === '/v1/meta') return send(200, JSON.stringify(API_META), { 'cache-control': 'public, max-age=60' });
      if (req.method === 'GET' && req.url?.startsWith('/v1/content/')) {
        if (!content) return send(503, '{"error":"content unavailable"}');
        let entry = ''; try { entry = decodeURIComponent(req.url.slice('/v1/content/'.length)); } catch { return send(400, '{"error":"invalid entry"}'); }
        const out = await content({ headers: req.headers as Record<string, string | undefined>, entry }); return send(out.status, out.body, out.headers);
      }
      if (req.method !== 'POST' || req.url !== '/v1/shop') return send(404, '{"error":"not found"}');
      const chunks: Buffer[] = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(413, '{"error":"too large"}'); chunks.push(c as Buffer); }
      const out = await handle({ headers: req.headers as Record<string, string | undefined>, body: Buffer.concat(chunks).toString('utf8') });
      send(out.status, out.body, out.headers);
    } catch { send(500, '{"error":"internal"}'); }          // no stack, no message
  });
}
