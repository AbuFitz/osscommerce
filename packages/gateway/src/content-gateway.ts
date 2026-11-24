import { createHash, randomUUID } from 'node:crypto';
import type { Audit, ContentStore, RateLimiter, Registry } from './ports.ts';

export interface ContentRequest { headers: Record<string, string | undefined>; entry: string }
export interface ContentResponse { status: number; headers: Record<string, string>; body: string }
export interface ContentGatewayDeps { registry: Registry; content: ContentStore; rateLimit: RateLimiter; audit: Audit }

const reply = (status: number, requestId: string, body: unknown, headers: Record<string, string> = {}): ContentResponse => ({ status, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, 'cache-control': 'no-store', ...headers }, body: body === '' ? '' : JSON.stringify(body) });

/** Published content is public data, but only a registered storefront server may retrieve it.
 * The credential fixes the tenant; the caller cannot select another store or raw revision. */
export function createContentGateway(d: ContentGatewayDeps) {
  return async (req: ContentRequest): Promise<ContentResponse> => {
    const requestId = randomUUID(); const h = (k: string) => req.headers[k] ?? req.headers[k.toLowerCase()];
    if (!/^[a-z0-9][a-z0-9:/_-]{0,119}$/.test(req.entry)) return reply(400, requestId, { error: 'invalid entry' });
    const secret = /^Bearer (\S{40,200})$/.exec(h('authorization') ?? '')?.[1];
    if (!secret) return reply(401, requestId, { error: 'unauthorized' });
    const who = await d.registry.resolve(createHash('sha256').update(secret).digest());
    if (!who) return reply(401, requestId, { error: 'unauthorized' });
    if (h('oss-storefront') !== who.storefrontId) return reply(403, requestId, { error: 'forbidden' });
    if (!d.rateLimit.take(who.storefrontId)) return reply(429, requestId, { error: 'rate_limited' }, { 'retry-after': '1' });
    const content = await d.content.get(who.storefrontId, req.entry);
    if (!content) { d.audit.record({ ...who, operation: `content:${req.entry}`, outcome: 'ok', reason: 'not_found', requestId }); return reply(404, requestId, { error: 'not found' }); }
    const body = JSON.stringify(content); const etag = `"${createHash('sha256').update(body).digest('base64url')}"`;
    d.audit.record({ ...who, operation: `content:${req.entry}`, outcome: 'ok', requestId });
    if (h('if-none-match') === etag) return { status: 304, headers: { 'oss-request-id': requestId, etag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }, body: '' };
    return { status: 200, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, etag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }, body };
  };
}
