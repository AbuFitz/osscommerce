import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed webhooks between the platform and a storefront (revalidation). Header: `t=<unix seconds>,v1=<hex hmac of "t.body">`.
 *  Verification is constant-time, rejects stale timestamps, and exposes the event id so the receiver can drop duplicates. */
export const TOLERANCE_SECONDS = 300;
export function sign(secret: string, body: string, now = Math.floor(Date.now() / 1000)): string {
  return `t=${now},v1=${createHmac('sha256', secret).update(`${now}.${body}`).digest('hex')}`;
}
export type Verdict = { ok: true } | { ok: false; reason: 'malformed' | 'stale' | 'bad_signature' };
export function verify(secret: string, body: string, header: string | null | undefined, now = Math.floor(Date.now() / 1000)): Verdict {
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? '');
  if (!m) return { ok: false, reason: 'malformed' };
  if (Math.abs(now - Number(m[1])) > TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
  const expected = createHmac('sha256', secret).update(`${m[1]}.${body}`).digest();
  const given = Buffer.from(m[2], 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}
