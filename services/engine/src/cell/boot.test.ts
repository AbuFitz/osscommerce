import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig, EventBus, TransactionalConnection } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import Stripe from 'stripe';
import { feeMinor } from '@oss-commerce/contracts';
import { CellPlugin, MemGate } from './plugin.ts';
import { OutboxService } from './events.ts';
import { sign } from './outbox.ts';
import type { StripePort, PaymentIntentLite } from './stripe-port.ts';

const dir = path.join(__dirname, '.tmp-boot'); fs.mkdirSync(dir, { recursive: true });
registerInitializer('sqljs', new SqljsInitializer(dir));

// An in-memory Stripe that behaves like the parts we rely on: PaymentIntents live on a connected account, refunds can return the fee.
const intents = new Map<string, PaymentIntentLite>(); const refunds: any[] = []; let n = 0;
const stripe: StripePort = {
  async createPaymentIntent(account, p) { const id = `pi_${++n}`; intents.set(id, { id, status: 'requires_payment_method', amount: p.amount, currency: p.currency, metadata: p.metadata, application_fee_amount: p.applicationFeeAmount }); return { id, clientSecret: `${id}_secret` }; },
  async retrievePaymentIntent(_a, id) { return intents.get(id)!; },
  async createRefund(a, p) { refunds.push({ a, ...p }); return { id: `re_${refunds.length}`, status: 'succeeded' }; },
};
const delivered: { body: string; sig: string }[] = [];
const deps: any = { account: 'acct_1', seen: { markIfNew: async () => true }, orders: { byOrderCode: async () => null, setPaymentState: async () => {}, flagForReview: async () => {} }, checkout: { restrict: async () => {}, allow: async () => {} } };
const gate = new MemGate(); const CONTROL = 'c'.repeat(43);
const config = mergeConfig(testConfig, {
  authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } },
  plugins: [CellPlugin.init({ stripe, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true, storeId: 'store_a', publishableKey: 'pk_test_x', checkoutGate: gate, controlSecret: CONTROL,
    outbox: { cellId: 'cell_a', secret: 's'.repeat(43), url: 'https://cp/ingest', intervalMs: 3_600_000, post: async (_u, i) => { delivered.push({ body: i.body, sig: i.headers['oss-signature'] }); return { status: 200 }; } } }, deps)],
});
const { server, adminClient, shopClient } = createTestEnvironment(config);
const initialData: any = { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] };
const g = (s: string) => parse(s);
before(async () => { await server.init({ initialData, productsCsvPath: path.join(__dirname, '../../proofs/products.csv'), customerCount: 0 }); await adminClient.asSuperAdmin();
  await adminClient.query(g(`mutation($i: CreatePaymentMethodInput!){ createPaymentMethod(input:$i){ id } }`), { i: { code: 'stripe-connect', enabled: true, handler: { code: 'stripe-connect', arguments: [] }, translations: [{ languageCode: 'en', name: 'Card' }] } }); });
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });

async function toArrangingPayment(email = 'maya@example.com') {
  await shopClient.asAnonymousUser();
  await shopClient.query(g(`mutation{ addItemToOrder(productVariantId: 1, quantity: 2){ __typename } }`));
  await shopClient.query(g(`mutation($i: CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`), { i: { emailAddress: email, firstName: 'Maya', lastName: 'Lee' } });
  await shopClient.query(g(`mutation($i: CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename } }`), { i: { fullName: 'Maya Lee', streetLine1: '1 High St', city: 'Watford', postalCode: 'WD24 6SX', countryCode: 'GB' } });
  const m = await shopClient.query(g(`query{ eligibleShippingMethods{ id } }`));
  await shopClient.query(g(`mutation($id: [ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`), { id: [m.eligibleShippingMethods[0].id] });
  const t = await shopClient.query(g(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename ... on Order { code state totalWithTax currencyCode } } }`));
  return t.transitionOrderToState as { code: string; totalWithTax: number; currencyCode: string };
}
const pay = (id: string) => shopClient.query(g(`mutation($i: PaymentInput!){ addPaymentToOrder(input:$i){ __typename ... on Order { code state } ... on ErrorResult { message } } }`), { i: { method: 'stripe-connect', metadata: { paymentIntentId: id } } });

test('boot: the Connect handler is registered with Vendure', async () => {
  const r = await adminClient.query(g(`query{ paymentMethodHandlers{ code } }`)); assert.ok(r.paymentMethodHandlers.some((h: any) => h.code === 'stripe-connect'));
});
test('boot: webhook route is live and rejects an unsigned call', async () => {
  assert.equal((await fetch(`http://localhost:${testConfig.apiOptions.port}/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
});
test('payment session is refused with no order, and before the order is ready for payment', async () => {
  await shopClient.asAnonymousUser(); await assert.rejects(shopClient.query(g(`mutation{ createPaymentSession{ clientSecret } }`)), /no active order|no-active-session/);
  await shopClient.query(g(`mutation{ addItemToOrder(productVariantId: 1, quantity: 1){ __typename } }`)); await assert.rejects(shopClient.query(g(`mutation{ createPaymentSession{ clientSecret } }`)), /not ready/);
});
test('full checkout: server derives amount and fee, verified payment settles the order, an event is recorded and delivered', async () => {
  const order = await toArrangingPayment();
  const s = (await shopClient.query(g(`mutation{ createPaymentSession{ clientSecret paymentIntentId publishableKey stripeAccount amount currency orderCode } }`))).createPaymentSession;
  assert.equal(s.amount, order.totalWithTax); assert.equal(s.stripeAccount, 'acct_1'); assert.equal(s.publishableKey, 'pk_test_x'); assert.equal(s.currency, order.currencyCode.toLowerCase(), 'currency comes from the order, not the browser');
  const pi = intents.get(s.paymentIntentId)!; assert.equal(pi.application_fee_amount, feeMinor(order.totalWithTax, 50), 'fee is computed on the server'); assert.equal(pi.metadata.orderCode, order.code);
  assert.equal((await pay(s.paymentIntentId)).addPaymentToOrder.__typename, 'PaymentDeclinedError', 'not paid at Stripe yet: not accepted'); pi.status = 'succeeded';
  const done = (await pay(s.paymentIntentId)).addPaymentToOrder; assert.equal(done.state, 'PaymentSettled');
  const svc = server.app.get(OutboxService); await new Promise(r => setTimeout(r, 300));
  const due = await svc.outbox.due(Date.now(), 10); const ev = due.map(r => r.event).find(e => e.type === 'order.paid')!; assert.ok(ev, 'order.paid recorded'); assert.equal(ev.storeId, 'store_a'); assert.equal(ev.data.totalMinor, order.totalWithTax); assert.equal(ev.recipient.email, 'maya@example.com');
  assert.match(String(ev.data.placedAt), /^\d{4}-\d{2}-\d{2}T/); assert.equal(ev.data.customerName, 'Maya Lee'); assert.match(String(ev.data.shipTo), /1 High St.*Watford.*WD24 6SX/);
  assert.ok(Array.isArray(ev.data.lines) && ev.data.lines.length === 1); assert.equal((ev.data.lines as any[])[0].quantity, 2); assert.ok(Number(ev.data.vatMinor) > 0);
  assert.deepEqual(await svc.tick(CellPlugin.options.outbox!), { sent: due.length, failed: 0 }); assert.ok(delivered.length >= 1 && /^t=\d+,v1=[0-9a-f]{64}$/.test(delivered[0].sig));
  const b = JSON.parse(delivered[0].body); assert.equal(b.cellId, 'cell_a'); assert.equal(sign('s'.repeat(43), delivered[0].body, Number(/t=(\d+)/.exec(delivered[0].sig)![1])), delivered[0].sig);
});
test('a payment cannot be reused across orders, and a tampered amount is refused', async () => {
  const o1 = await toArrangingPayment('a@example.com'); const s1 = (await shopClient.query(g(`mutation{ createPaymentSession{ paymentIntentId } }`))).createPaymentSession; intents.get(s1.paymentIntentId)!.status = 'succeeded';
  const o2 = await toArrangingPayment('b@example.com'); assert.notEqual(o1.code, o2.code);
  assert.equal((await pay(s1.paymentIntentId)).addPaymentToOrder.__typename, 'PaymentDeclinedError', 'intent belongs to the other order');
  const s2 = (await shopClient.query(g(`mutation{ createPaymentSession{ paymentIntentId } }`))).createPaymentSession; const pi = intents.get(s2.paymentIntentId)!; pi.status = 'succeeded'; pi.amount -= 1;
  assert.equal((await pay(s2.paymentIntentId)).addPaymentToOrder.__typename, 'PaymentDeclinedError', 'amount mismatch');
});
test('sweep recovers an event lost between commit and subscriber', async () => {
  const svc = server.app.get(OutboxService); const conn = server.app.get(TransactionalConnection);
  await conn.rawConnection.query('delete from oss_outbox'); assert.equal((await svc.outbox.due(Date.now(), 10)).length, 0);
  const added = await svc.sweep(); assert.ok(added >= 1); assert.ok((await svc.outbox.due(Date.now(), 10)).some(r => r.event.type === 'order.paid')); assert.equal(await svc.sweep(), 0, 'idempotent');
});

const control = (body: object, sig?: string | null) => { const b = JSON.stringify(body); return fetch(`http://localhost:${testConfig.apiOptions.port}/control/checkout`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sig === null ? {} : { 'oss-signature': sig ?? sign(CONTROL, b) }) }, body: b }); };
test('control plane can block and re-allow checkout; unsigned, forged and out-of-order calls cannot', async () => {
  await toArrangingPayment('gate@example.com');
  assert.equal((await control({ allowed: false, sequence: 1 }, null)).status, 401); assert.equal((await control({ allowed: false, sequence: 1 }, sign('x'.repeat(43), '{}'))).status, 401); assert.equal(gate.allowed, true);
  assert.equal((await control({ allowed: false, reason: 'requirements.past_due', sequence: 5 })).status, 200); assert.equal(gate.allowed, false);
  await assert.rejects(shopClient.query(g(`mutation{ createPaymentSession{ clientSecret } }`)), /temporarily unavailable/);
  assert.equal((await (await control({ allowed: true, sequence: 4 })).json()).stale, true); assert.equal(gate.allowed, false, 'an older allow does not undo a newer block');
  assert.equal((await control({ allowed: true, sequence: 6 })).status, 200); assert.ok((await shopClient.query(g(`mutation{ createPaymentSession{ clientSecret } }`))).createPaymentSession.clientSecret);
});
test('merchant and payment restrictions are independent', async () => {
  assert.equal((await control({ allowed: false, reason: 'merchant_paused', sequence: 10, source: 'merchant' })).status, 200);
  assert.equal((await control({ allowed: false, reason: 'requirements.past_due', sequence: 10, source: 'payments' })).status, 200);
  assert.equal((await control({ allowed: true, sequence: 11, source: 'merchant' })).status, 200);
  assert.equal((await gate.get()).allowed, false, 'merchant unpause must not erase a Stripe restriction');
  assert.equal((await control({ allowed: true, sequence: 11, source: 'payments' })).status, 200);
  assert.equal((await gate.get()).allowed, true);
});
