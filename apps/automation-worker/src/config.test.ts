import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from './config.ts';

const good = { APP_ENV: 'staging', CONTROL_PLANE_DATABASE_URL: 'postgresql://runtime@db.test/cp', QUEUE_DATABASE_URL: 'postgresql://queue@db.test/cp', RESEND_API_KEY: 're_fixture', RESEND_WEBHOOK_SECRET: 'whsec_fixture', UNSUBSCRIBE_SECRET: 'ab'.repeat(32), PUBLIC_BASE_URL: 'https://automation.test/', CELL_CREDENTIALS_JSON: JSON.stringify({ cell_a: { storeId: 'store_a', secret: 's'.repeat(43) } }) };
test('worker config separates database roles, parses cell credentials and normalises its URL', () => {
  const c = loadConfig(good); assert.equal(c.PUBLIC_BASE_URL, 'https://automation.test'); assert.equal(c.cells.cell_a.storeId, 'store_a'); assert.equal(c.PORT, 3200);
});
test('worker config fails closed on shared roles, malformed cells and insecure public URLs', () => {
  assert.throws(() => loadConfig({ ...good, QUEUE_DATABASE_URL: good.CONTROL_PLANE_DATABASE_URL }), /separate roles/);
  assert.throws(() => loadConfig({ ...good, CELL_CREDENTIALS_JSON: '{}' }), /At least one/);
  assert.throws(() => loadConfig({ ...good, PUBLIC_BASE_URL: 'http://automation.test' }));
});
