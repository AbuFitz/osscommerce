import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutControlConfig, setCheckoutPaused } from './engine/checkout-control.ts';

test('checkout control derives the private route and validates production credentials', () => {
  assert.deepEqual(checkoutControlConfig({ ENGINE_ADMIN_URL: 'https://cell.example/admin-api', ENGINE_CONTROL_SECRET: 's'.repeat(32), APP_ENV: 'production' }), { url: 'https://cell.example/control/checkout', secret: 's'.repeat(32) });
  assert.throws(() => checkoutControlConfig({ ENGINE_CONTROL_URL: 'http://cell.example/control/checkout', ENGINE_CONTROL_SECRET: 's'.repeat(32), APP_ENV: 'production' }), /HTTPS/);
  assert.throws(() => checkoutControlConfig({ ENGINE_CONTROL_URL: 'https://cell.example/control/checkout', ENGINE_CONTROL_SECRET: 'short' }), /32/);
});

test('checkout control signs a merchant-scoped pause and fails closed', async () => {
  let sent: RequestInit | undefined;
  const ok = await setCheckoutPaused({ url: 'https://cell.example/control/checkout', secret: 's'.repeat(32) }, true, async (_url, init) => { sent = init; return new Response('{"ok":true}', { status: 200 }); }, 1_700_000_000_000);
  assert.equal(ok.ok, true); assert.deepEqual(JSON.parse(String(sent?.body)), { allowed: false, reason: 'merchant_paused', sequence: 1_700_000_000_000, source: 'merchant' });
  assert.match(String((sent?.headers as Record<string, string>)['oss-signature']), /^t=1700000000,v1=[0-9a-f]{64}$/);
  assert.equal((await setCheckoutPaused({ url: 'https://cell.example/control/checkout', secret: 's'.repeat(32) }, false, async () => new Response('{"stale":true}', { status: 200 }))).ok, false);
});
