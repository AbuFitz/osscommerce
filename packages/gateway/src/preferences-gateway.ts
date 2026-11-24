import { createHash, randomUUID } from 'node:crypto';
import type { Audit, PreferencesStore, RateLimiter, Registry } from './ports.ts';

export interface PreferencesRequest { headers: Record<string, string | undefined> }
export interface PreferencesResponse { status: number; headers: Record<string, string>; body: string }

/** Public storefront behaviour, authenticated by the same server credential as catalogue and content.
 * The credential fixes the tenant; private merchant alert settings never leave the control plane. */
export function createPreferencesGateway(d: { registry: Registry; preferences: PreferencesStore; rateLimit: RateLimiter; audit: Audit }) {
  const reply = (status: number, requestId: string, body: unknown, headers: Record<string, string> = {}): PreferencesResponse => ({ status, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) });
  return async (req: PreferencesRequest): Promise<PreferencesResponse> => {
    const requestId = randomUUID(); const h = (key: string) => req.headers[key] ?? req.headers[key.toLowerCase()];
    const secret = /^Bearer (\S{40,200})$/.exec(h('authorization') ?? '')?.[1];
    if (!secret) return reply(401, requestId, { error: 'unauthorized' });
    const who = await d.registry.resolve(createHash('sha256').update(secret).digest());
    if (!who) return reply(401, requestId, { error: 'unauthorized' });
    if (h('oss-storefront') !== who.storefrontId) return reply(403, requestId, { error: 'forbidden' });
    if (!d.rateLimit.take(who.storefrontId)) return reply(429, requestId, { error: 'rate_limited' }, { 'retry-after': '1' });
    const preferences = await d.preferences.get(who.storefrontId);
    if (!preferences) return reply(404, requestId, { error: 'not found' });
    const body = JSON.stringify(preferences); const etag = `"${createHash('sha256').update(body).digest('base64url')}"`;
    d.audit.record({ ...who, operation: 'preferences:read', outcome: 'ok', requestId });
    if (h('if-none-match') === etag) return { status: 304, headers: { 'oss-request-id': requestId, etag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }, body: '' };
    return { status: 200, headers: { 'content-type': 'application/json', 'oss-request-id': requestId, etag, 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' }, body };
  };
}
