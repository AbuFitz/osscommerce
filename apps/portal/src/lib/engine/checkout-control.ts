import { createHmac } from 'node:crypto';
import type { MutationResult } from '../gateway';

export interface CheckoutControlConfig { url: string; secret: string }

export function checkoutControlConfig(env: Record<string, string | undefined> = process.env): CheckoutControlConfig | null {
  const admin = env.ENGINE_ADMIN_URL;
  const url = env.ENGINE_CONTROL_URL ?? (admin ? new URL('/control/checkout', admin).toString() : '');
  const secret = env.ENGINE_CONTROL_SECRET ?? '';
  if (!url || !secret) return null;
  const parsed = new URL(url);
  if (env.APP_ENV === 'production' && parsed.protocol !== 'https:') throw new Error('ENGINE_CONTROL_URL must use HTTPS in production.');
  if (secret.length < 32) throw new Error('ENGINE_CONTROL_SECRET must contain at least 32 characters.');
  return { url: parsed.toString(), secret };
}

export async function setCheckoutPaused(config: CheckoutControlConfig, paused: boolean, f: typeof fetch = fetch, now = Date.now()): Promise<MutationResult> {
  const body = JSON.stringify({ allowed: !paused, reason: paused ? 'merchant_paused' : undefined, sequence: now, source: 'merchant' });
  const seconds = Math.floor(now / 1000);
  const signature = `t=${seconds},v1=${createHmac('sha256', config.secret).update(`${seconds}.${body}`).digest('hex')}`;
  let response: Response;
  try { response = await f(config.url, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', 'oss-signature': signature }, body }); }
  catch { return { ok: false, message: 'The store could not be reached, so checkout was not changed.' }; }
  if (!response.ok) return { ok: false, message: 'The store refused the checkout change. Nothing was saved.' };
  const result = await response.json().catch(() => null) as { ok?: boolean; stale?: boolean } | null;
  if (!result?.ok || result.stale) return { ok: false, message: 'A newer checkout setting is already active. Refresh and try again.' };
  return { ok: true, message: paused ? 'Checkout is paused.' : 'Checkout is open.' };
}

export async function setCheckoutPausedFromEnv(paused: boolean) {
  const config = checkoutControlConfig();
  if (!config) return { ok: false, message: 'Checkout control is not configured for this store.' };
  return setCheckoutPaused(config, paused);
}
