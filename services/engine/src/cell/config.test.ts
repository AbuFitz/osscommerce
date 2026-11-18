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
test('config: without Redis the queue is the Postgres-backed one, persistent, with bounded retries', () => {
  const { REDIS_URL: _r, ...noRedis } = base as any; const c = buildCellConfig(parseEnv(noRedis)); const names = (c.plugins ?? []).map((p: any) => p.name ?? p.constructor?.name);
  assert.ok(names.includes('DefaultJobQueuePlugin')); assert.ok(!names.includes('BullMQJobQueuePlugin')); assert.equal((c.dbConnectionOptions as any).migrationsRun, false, 'migrations are a separate step, never run by a booting server or worker');
});

test('config: shoppers see out / low / in stock around the configured level, never a count', async () => {
  const { ThresholdStockDisplayStrategy } = await import('./stock-display.ts'); const s = new ThresholdStockDisplayStrategy(5); const lvl = (n: number) => s.getStockLevel({} as any, {} as any, n);
  assert.equal(lvl(0), 'OUT_OF_STOCK'); assert.equal(lvl(-2), 'OUT_OF_STOCK'); assert.equal(lvl(1), 'LOW_STOCK'); assert.equal(lvl(5), 'LOW_STOCK'); assert.equal(lvl(6), 'IN_STOCK');
  assert.equal((buildCellConfig(parseEnv({ ...base, LOW_STOCK_AT: '2' })) as any).catalogOptions.stockDisplayStrategy.lowAt, 2);
  assert.equal((buildCellConfig(parseEnv(base)) as any).catalogOptions.stockDisplayStrategy.lowAt, 5);
});
