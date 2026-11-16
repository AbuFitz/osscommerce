import { z } from 'zod';

/** Cell configuration. One engine process serves exactly one merchant: store, channel, database and Stripe account are fixed at boot.
 *  Fails closed: missing or unsafe settings stop the process rather than falling back to defaults. */
const Base = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
  STORE_ID: z.string().min(3), CELL_ID: z.string().min(3), CHANNEL_TOKEN: z.string().min(16),
  DATABASE_URL: z.string().url(),
  /** Direct (non-pooled) connection for migrations. Falls back to DATABASE_URL. */
  DATABASE_URL_DIRECT: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  SUPERADMIN_USER: z.string().min(1), SUPERADMIN_PASSWORD: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'), STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_CONNECTED_ACCOUNT_ID: z.string().startsWith('acct_'),
  FEE_BP: z.coerce.number().int().min(0).max(1000), REFUNDS_RETURN_FEE: z.enum(['true', 'false']).default('true'),
  NEXT_PUBLIC_OSS_DEMO: z.string().optional(),
});
export type CellEnv = z.infer<typeof Base>;

export function parseEnv(raw: Record<string, string | undefined>): CellEnv {
  const e = Base.parse(raw);
  const prodLike = e.APP_ENV === 'production' || e.APP_ENV === 'staging';
  if (e.APP_ENV === 'production' && !e.STRIPE_SECRET_KEY.startsWith('sk_live_') && !e.STRIPE_SECRET_KEY.startsWith('rk_live_')) throw new Error('Production requires a live Stripe key.');
  if (e.APP_ENV !== 'production' && /^(sk|rk)_live_/.test(e.STRIPE_SECRET_KEY)) throw new Error('A live Stripe key must never run outside production.');
  if (prodLike && (e.SUPERADMIN_USER === 'superadmin' || e.SUPERADMIN_PASSWORD === 'superadmin')) throw new Error('Default superadmin credentials are not allowed.');
  if (e.APP_ENV === 'production' && e.NEXT_PUBLIC_OSS_DEMO) throw new Error('Demo mode must not be set in production.');
  return e;
}
