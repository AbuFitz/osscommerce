import { z } from 'zod';

const Env = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3300),
  CONTROL_PLANE_DATABASE_URL: z.string().url().startsWith('postgres'),
  GATEWAY_SESSION_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  STOREFRONT_BURST: z.coerce.number().int().min(1).max(10000).default(120),
  STOREFRONT_PER_SECOND: z.coerce.number().positive().max(1000).default(20),
  SESSION_BURST: z.coerce.number().int().min(1).max(1000).default(30),
  SESSION_PER_SECOND: z.coerce.number().positive().max(100).default(5),
});

export function loadConfig(raw: Record<string, string | undefined>) {
  if (Object.keys(raw).some(key => key.startsWith('NEXT_PUBLIC_') && /GATEWAY|DATABASE|SESSION/.test(key))) throw new Error('Gateway and database secrets must never use NEXT_PUBLIC_ variables.');
  const env = Env.parse(raw);
  const database = new URL(env.CONTROL_PLANE_DATABASE_URL);
  if (env.APP_ENV !== 'development' && !['require','verify-ca','verify-full'].includes(database.searchParams.get('sslmode') ?? '')) throw new Error('CONTROL_PLANE_DATABASE_URL must require TLS outside development.');
  return env;
}
export type GatewayConfig = ReturnType<typeof loadConfig>;
