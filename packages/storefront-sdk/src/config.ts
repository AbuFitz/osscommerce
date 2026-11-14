import { z } from 'zod';

/** Storefront configuration. Parsed once at server start; a storefront with missing or inconsistent config refuses to boot.
 *  There is deliberately no default store, channel or environment: the Vendure starter falls back to `__default_channel__`,
 *  which on a shared engine would silently serve the wrong merchant. Nothing here may be prefixed NEXT_PUBLIC_ except public values. */
const Raw = z.object({
  OSS_COMMERCE_API_URL: z.string().url(),
  OSS_STORE_ID: z.string().min(3),
  OSS_STOREFRONT_ID: z.string().min(3),
  OSS_ENV: z.enum(['development', 'preview', 'staging', 'production']),
  OSS_STOREFRONT_SERVER_SECRET: z.string().min(40),     // 256-bit random, base64url. Server only.
  OSS_REVALIDATION_SECRET: z.string().min(40),          // distinct from the server secret
  OSS_SITE_URL: z.string().url(),
});
export type StorefrontConfig = Readonly<{ apiUrl: string; storeId: string; storefrontId: string; env: 'development' | 'preview' | 'staging' | 'production'; serverSecret: string; revalidationSecret: string; siteUrl: string; liveOrders: boolean }>;

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined>): StorefrontConfig {
  const leaked = Object.keys(env).filter(k => k.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|PASSWORD|PRIVATE|KEY/i.test(k));
  if (leaked.length) throw new ConfigError(`Secret-looking variables must not be public: ${leaked.join(', ')}`);
  const r = Raw.safeParse(env);
  if (!r.success) throw new ConfigError(`Invalid storefront configuration: ${r.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const c = r.data;
  if (c.OSS_STOREFRONT_SERVER_SECRET === c.OSS_REVALIDATION_SECRET) throw new ConfigError('The server and revalidation secrets must differ.');
  const api = new URL(c.OSS_COMMERCE_API_URL);
  if (c.OSS_ENV !== 'development' && api.protocol !== 'https:') throw new ConfigError('The API URL must be https outside development.');
  if (c.OSS_ENV === 'production' && /^(localhost|127\.|.*\.vercel\.app$)/.test(new URL(c.OSS_SITE_URL).hostname)) throw new ConfigError('Production needs the merchant\'s own domain as OSS_SITE_URL.');
  return Object.freeze({ apiUrl: c.OSS_COMMERCE_API_URL.replace(/\/$/, ''), storeId: c.OSS_STORE_ID, storefrontId: c.OSS_STOREFRONT_ID, env: c.OSS_ENV, serverSecret: c.OSS_STOREFRONT_SERVER_SECRET, revalidationSecret: c.OSS_REVALIDATION_SECRET, siteUrl: c.OSS_SITE_URL, liveOrders: c.OSS_ENV === 'production' });
}
