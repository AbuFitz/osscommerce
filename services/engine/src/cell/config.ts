import { DefaultJobQueuePlugin, DefaultSearchPlugin, VendureConfig, LanguageCode } from '@vendure/core';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { HardenPlugin } from '@vendure/harden-plugin';
import type { CellEnv } from './env.ts';

/** Vendure configuration for ONE merchant cell. Built only from validated env; nothing here has an unsafe default.
 *  Tenancy: one cell = one database = one merchant (ADR 0001). Channels are not used as a tenant boundary. */
export function buildCellConfig(env: CellEnv): VendureConfig {
  const prod = env.APP_ENV === 'production';
  const redis = env.REDIS_URL ? new URL(env.REDIS_URL) : null;
  return {
    apiOptions: {
      port: 3000, adminApiPath: 'admin-api', shopApiPath: 'shop-api',
      adminApiPlayground: false, adminApiDebug: false, shopApiPlayground: false, shopApiDebug: false,
      cors: false,                                  // storefronts call the cell server-side; no browser CORS surface
    },
    authOptions: {
      tokenMethod: ['cookie', 'bearer'],
      requireVerification: true,
      superadminCredentials: { identifier: env.SUPERADMIN_USER, password: env.SUPERADMIN_PASSWORD },
      cookieOptions: { secret: env.COOKIE_SECRET, name: 'oss_session', httpOnly: true, secure: prod || env.APP_ENV === 'staging', sameSite: 'lax' },
    },
    dbConnectionOptions: { type: 'postgres', url: env.DATABASE_URL, synchronize: false, migrationsRun: true, logging: false, ssl: prod || env.APP_ENV === 'staging' ? { rejectUnauthorized: true } : false },
    defaultLanguageCode: LanguageCode.en,
    defaultChannelToken: env.CHANNEL_TOKEN,
    paymentOptions: { paymentMethodHandlers: [] },   // Connect handler is registered by the cell bootstrap, never the default dummy handler
    plugins: [
      HardenPlugin.init({ maxQueryComplexity: 650, apiMode: prod ? 'prod' : 'dev', hideFieldSuggestions: prod, logComplexityScore: false }),
      redis
        ? BullMQJobQueuePlugin.init({ connection: { host: redis.hostname, port: Number(redis.port || 6379), password: redis.password || undefined, username: redis.username || undefined, tls: redis.protocol === 'rediss:' ? {} : undefined } })
        : DefaultJobQueuePlugin.init({ useDatabaseForBuffer: false }),   // development only; parseEnv forbids this in staging/production
      DefaultSearchPlugin.init({ bufferUpdates: true }),
    ],
  };
}
