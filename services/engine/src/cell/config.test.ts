import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from './env.ts';
import { buildCellConfig } from './config.ts';

const base = { APP_ENV: 'staging', STORE_ID: 'store_demo', CELL_ID: 'cell_demo', CHANNEL_TOKEN: 'x'.repeat(20), DATABASE_URL: 'postgres://u:p@h/db', REDIS_URL: 'rediss://:pw@r.example:6380', SUPERADMIN_USER: 'ops-admin', SUPERADMIN_PASSWORD: 'long-random-pass', COOKIE_SECRET: 'c'.repeat(40), STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_abc', STRIPE_CONNECTED_ACCOUNT_ID: 'acct_1', FEE_BP: '50' };

test('config: no playground or debug, no CORS, secure httpOnly cookie, migrations not auto-synced', () => {
  const c: any = buildCellConfig(parseEnv(base));
  assert.equal(c.apiOptions.adminApiPlayground, false); assert.equal(c.apiOptions.shopApiDebug, false); assert.equal(c.apiOptions.cors, false);
  assert.equal(c.authOptions.cookieOptions.secure, true); assert.equal(c.authOptions.cookieOptions.httpOnly, true);
  assert.equal(c.dbConnectionOptions.synchronize, false); assert.equal(c.authOptions.requireVerification, true);
});
test('config: uses Redis queue, never the database-polling queue, when Redis is set', () => {
  const names = (buildCellConfig(parseEnv(base)).plugins ?? []).map((p: any) => p.name ?? p.constructor?.name);
  assert.ok(names.includes('BullMQJobQueuePlugin')); assert.ok(!names.includes('DefaultJobQueuePlugin'));
});
test('config: no default payment handler is registered', () => assert.deepEqual((buildCellConfig(parseEnv(base)) as any).paymentOptions.paymentMethodHandlers, []));
test('config: superadmin credentials come from env', () => assert.equal((buildCellConfig(parseEnv(base)) as any).authOptions.superadminCredentials.identifier, 'ops-admin'));
