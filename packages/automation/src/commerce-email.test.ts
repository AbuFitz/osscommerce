import assert from 'node:assert/strict';
import test from 'node:test';
import { PermanentError } from './model.ts';
import { commerceEmailPreparer } from './commerce-email.ts';

const profile = {
  fromName: 'Kiln & Thread', fromEmail: 'orders@shop.test', replyTo: 'help@shop.test',
  storefrontUrl: 'https://shop.test',
  brand: { shopName: 'Kiln & Thread', accent: '#2c3a15', supportEmail: 'help@shop.test' },
};
const data = {
  orderCode: '1042', placedAt: '2026-11-23T12:00:00.000Z', customerName: 'Maya',
  lines: [{ title: 'Stoneware mug', quantity: 2, unitMinor: 1800 }],
  subtotalMinor: 3600, shippingMinor: 495, vatMinor: 682, totalMinor: 4095, currency: 'GBP',
  shipTo: '12 Mill Lane, Bristol BS1 4AX',
};
const request = { storeId: 'store_a', template: 'order_confirmation', to: 'maya@buyer.test', audience: 'shopper' as const, data, idempotencyKey: 'x', headers: {} };

test('commerce email preparer renders the real shared template from a complete event snapshot', async () => {
  const out = await commerceEmailPreparer(async () => profile)(request);
  assert.equal(out.from, 'Kiln & Thread <orders@shop.test>');
  assert.equal(out.replyTo, 'help@shop.test');
  assert.match(out.subject, /Kiln & Thread order #1042/);
  assert.match(out.text!, /Stoneware mug/);
  assert.match(out.text!, /£40\.95/);
  assert.match(out.html, /https:\/\/shop\.test\/account\/orders\/1042/);
});

test('commerce email preparer refuses incomplete events and unknown templates instead of inventing customer facts', async () => {
  const prepare = commerceEmailPreparer(async () => profile);
  await assert.rejects(prepare({ ...request, data: { orderCode: '1042' } }), PermanentError);
  await assert.rejects(prepare({ ...request, template: 'made_up' }), PermanentError);
  await assert.rejects(commerceEmailPreparer(async () => null)(request), PermanentError);
});

test('account emails (staff invitation, password reset) come from the platform with the link, and refuse an incomplete event', async () => {
  const prepare = commerceEmailPreparer(async () => null, { fromName: 'OneSimpleCommerce', fromEmail: 'accounts@mail.example.com' });
  const base = { storeId: 's1', to: 'sam@example.com', audience: 'shopper' as const, idempotencyKey: 'k', headers: {} };
  const invite = await prepare({ ...base, template: 'staff_invite', data: { name: 'Sam Lee', role: 'Fulfilment', invitedBy: 'Maya Okafor', actionUrl: 'https://portal.example/set-password?k=invite&t=abc', validHours: 168 } });
  assert.equal(invite.from, 'OneSimpleCommerce <accounts@mail.example.com>'); assert.match(invite.subject, /Maya Okafor invited you/); assert.match(invite.html!, /set-password\?k=invite&amp;t=abc/); assert.match(invite.text!, /7 days/); assert.match(invite.text!, /Fulfilment/);
  const reset = await prepare({ ...base, template: 'staff_password_reset', data: { name: 'Sam Lee', actionUrl: 'https://portal.example/set-password?k=reset&t=abc', validHours: 1 } });
  assert.match(reset.subject, /Reset your OneSimpleCommerce password/); assert.match(reset.text!, /an hour/);
  await assert.rejects(prepare({ ...base, template: 'staff_invite', data: { name: 'Sam' } }), /complete link/);
  await assert.rejects(commerceEmailPreparer(async () => null)({ ...base, template: 'staff_invite', data: {} }), /not configured/);
});
