import { z } from 'zod';

const Cell = z.object({ storeId: z.string().min(1), secret: z.string().min(32) }).strict();
const Env = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3200),
  CONTROL_PLANE_DATABASE_URL: z.string().url().startsWith('postgres'),
  QUEUE_DATABASE_URL: z.string().url().startsWith('postgres'),
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url().startsWith('https://'),
  CELL_CREDENTIALS_JSON: z.string().min(2),
});

export function loadConfig(raw: Record<string, string | undefined>) {
  const env = Env.parse(raw);
  if (env.APP_ENV !== 'development' && env.CONTROL_PLANE_DATABASE_URL === env.QUEUE_DATABASE_URL) throw new Error('Runtime and queue database credentials must use separate roles');
  let decoded: unknown; try { decoded = JSON.parse(env.CELL_CREDENTIALS_JSON); } catch { throw new Error('CELL_CREDENTIALS_JSON must be valid JSON'); }
  const cells = z.record(z.string().min(1), Cell).parse(decoded);
  if (!Object.keys(cells).length) throw new Error('At least one cell credential is required');
  return { ...env, PUBLIC_BASE_URL: env.PUBLIC_BASE_URL.replace(/\/$/, ''), cells };
}
export type WorkerConfig = ReturnType<typeof loadConfig>;
