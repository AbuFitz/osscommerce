import { createHmac, timingSafeEqual } from 'node:crypto';
/** The shopper session handed to a storefront is not Vendure's raw token. It is bound to one storefront, so a session or cart id
 *  from merchant A's storefront is useless at merchant B's, even if both talk to the same engine. */
export function wrap(key: string, storefrontId: string, raw: string): string {
  const body = `${storefrontId}.${Buffer.from(raw).toString('base64url')}`;
  return `v1.${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}
export function unwrap(key: string, storefrontId: string, session: string): string | null {
  const m = /^v1\.([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(session); if (!m || m[1] !== storefrontId) return null;
  const body = `${m[1]}.${m[2]}`, want = createHmac('sha256', key).update(body).digest(), got = Buffer.from(m[3], 'base64url');
  return got.length === want.length && timingSafeEqual(got, want) ? Buffer.from(m[2], 'base64url').toString() : null;
}
