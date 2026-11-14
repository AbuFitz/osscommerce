import { createHash, randomUUID } from 'node:crypto';
import { classify } from './operations.ts';
import { wrap, unwrap } from './session.ts';
import type { Registry, CellDirectory, RateLimiter, IdempotencyStore, Upstream, Audit } from './ports.ts';

export interface GatewayDeps { registry: Registry; cells: CellDirectory; storefrontLimit: RateLimiter; sessionLimit: RateLimiter; idempotency: IdempotencyStore; upstream: Upstream; audit: Audit; sessionKey: string; timeoutMs?: number }
export interface GatewayRequest { headers: Record<string, string | undefined>; body: string }
export interface GatewayResponse { status: number; headers: Record<string, string>; body: string }

const deny = (status: number, requestId: string, error: string, extra: Record<string, string> = {}): GatewayResponse => ({ status, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, 'cache-control': 'no-store', ...extra }, body: JSON.stringify({ error }) });

/** The only door between a storefront and a cell. Order of checks is deliberate:
 *  credential -> claimed identity -> rate -> operation allowlist -> session binding -> environment safety -> forward with platform-chosen channel. */
export function createGateway(d: GatewayDeps) {
  return async function handle(req: GatewayRequest): Promise<GatewayResponse> {
    const requestId = randomUUID(); const h = (k: string) => req.headers[k] ?? req.headers[k.toLowerCase()];
    const secret = /^Bearer (\S{40,200})$/.exec(h('authorization') ?? '')?.[1];
    if (!secret) { d.audit.record({ outcome: 'denied', reason: 'no_credential', requestId }); return deny(401, requestId, 'unauthorized'); }
    const who = await d.registry.resolve(createHash('sha256').update(secret).digest());
    if (!who) { d.audit.record({ outcome: 'denied', reason: 'bad_credential', requestId }); return deny(401, requestId, 'unauthorized'); }
    // The storefront the caller claims must be the one the credential belongs to. A mismatch is a bug or an attack; either way it is refused.
    if (h('oss-storefront') !== who.storefrontId) { d.audit.record({ ...who, outcome: 'denied', reason: 'storefront_mismatch', requestId }); return deny(403, requestId, 'forbidden'); }
    if (!d.storefrontLimit.take(who.storefrontId)) return deny(429, requestId, 'rate_limited', { 'retry-after': '1' });
    const c = classify((() => { try { return String(JSON.parse(req.body).query ?? ''); } catch { return ''; } })());
    if (!c.ok) { d.audit.record({ ...who, outcome: 'denied', reason: c.reason, requestId }); return deny(400, requestId, c.reason); }
    const operation = c.fields.join(',');
    let raw: string | undefined; const session = h('oss-session');
    if (session) { const r = unwrap(d.sessionKey, who.storefrontId, session); if (r === null) { d.audit.record({ ...who, operation, outcome: 'denied', reason: 'bad_session', requestId }); return deny(401, requestId, 'invalid session'); } raw = r; if (!d.sessionLimit.take(`${who.storefrontId}:${session}`)) return deny(429, requestId, 'rate_limited', { 'retry-after': '1' }); }
    else if (c.needsSession) return deny(401, requestId, 'session required');
    const cell = await d.cells.get(who.cellId);
    if (!cell || !cell.healthy) { d.audit.record({ ...who, operation, outcome: 'error', reason: 'cell_unavailable', requestId }); return deny(503, requestId, 'unavailable'); }
    // Non-production storefronts may only reach test-mode cells, and live cells only take production storefronts. This is what stops a preview placing a real order.
    if (who.liveOrders !== (cell.mode === 'live')) { d.audit.record({ ...who, operation, outcome: 'denied', reason: 'environment_mismatch', requestId }); return deny(403, requestId, 'environment mismatch'); }
    const idem = h('idempotency-key');
    if (c.kind === 'mutation' && idem) { const hit = await d.idempotency.get(`${who.storefrontId}:${idem}`); if (hit) return { status: hit.status, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, 'oss-replayed': 'true', 'cache-control': 'no-store' }, body: hit.body }; }
    // Forward with ONLY platform-chosen identity. Client-supplied channel, auth, cookie and forwarded headers are dropped, never trusted.
    const up = await d.upstream.post(`${cell.url}/shop-api`, { timeoutMs: d.timeoutMs ?? 8000, body: req.body, headers: { 'content-type': 'application/json', 'vendure-token': cell.channelToken, 'oss-request-id': requestId, ...(raw ? { authorization: `Bearer ${raw}` } : {}) } });
    const newRaw = up.headers['vendure-auth-token'];
    const out: GatewayResponse = { status: up.status, body: up.body, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, 'cache-control': c.cacheable ? 'public, max-age=0, must-revalidate' : 'no-store', ...(newRaw ? { 'oss-session': wrap(d.sessionKey, who.storefrontId, newRaw) } : {}) } };
    if (c.kind === 'mutation' && idem && up.status === 200) await d.idempotency.put(`${who.storefrontId}:${idem}`, { status: up.status, body: up.body });
    d.audit.record({ ...who, operation, outcome: up.status < 400 ? 'ok' : 'error', requestId });
    return out;
  };
}
