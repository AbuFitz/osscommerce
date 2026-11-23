import assert from 'node:assert/strict';
import test from 'node:test';
import { PermanentError } from './model.ts';
import { commerceEmailPreparer } from './commerce-email.ts';

const profile = {
  fromName: 'Kiln & Thread', fromEmail: 'orders@shop.test', replyTo: 'help@shop.test',
  brand: { shopName: 'Kiln & Thread', accent: '#2c3a15', supportEmail: 'help@shop.test' },
};
const data = {
  orderCode: '1042', placedAt: '23 Nov 2026', customerName: 'Maya',
  lines: [{ title: 'Stoneware mug', quantity: 2, unitMinor: 1800 }],
  subtotalMinor: 3600, shippingMinor: 495, vatMinor: 682, totalMinor: 4095, currency: 'GBP',
  shipTo: '12 Mill Lane, Bristol BS1 4AX', orderUrl: 'https://shop.test/account/orders/1042',
};
const request = { storeId: 'store_a', template: 'order_confirmation', to: 'maya@buyer.test', audience: 'shopper' as const, data, idempotencyKey: 'x', headers: {} };

test('commerce email preparer renders the real shared template from a complete event snapshot', async () => {
  const out = await commerceEmailPreparer(async () => profile)(request);
  assert.equal(out.from, 'Kiln & Thread <orders@shop.test>');
  assert.equal(out.replyTo, 'help@shop.test');
  assert.match(out.subject, /Kiln & Thread order #1042/);
  assert.match(out.text!, /Stoneware mug/);
  assert.match(out.text!, /£40\.95/);
});

test('commerce email preparer refuses incomplete events and unknown templates instead of inventing customer facts', async () => {
  const prepare = commerceEmailPreparer(async () => profile);
  await assert.rejects(prepare({ ...request, data: { orderCode: '1042' } }), PermanentError);
  await assert.rejects(prepare({ ...request, template: 'made_up' }), PermanentError);
  await assert.rejects(commerceEmailPreparer(async () => null)(request), PermanentError);
});
