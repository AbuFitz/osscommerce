// The portal's engine adapter, proven over real HTTP against a real Vendure with the cell plugin: sign in, read, add a product, take a paid order, fulfil and refund.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import Stripe from 'stripe';
import { CellPlugin, MemGate } from './plugin.ts';
import type { StripePort, PaymentIntentLite } from './stripe-port.ts';
import { engineLogin, httpExec, EngineError } from '../../../../apps/portal/src/lib/engine/exec.ts';
import { ensureTaxCategories } from '../../../../apps/portal/src/lib/engine/catalogue.ts';
import * as A from '../../../../apps/portal/src/lib/engine/adapter.ts';

const dir = path.join(__dirname, '.tmp-portal'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const intents = new Map<string, PaymentIntentLite>(); const refunds: any[] = []; let n = 0;
const stripe: StripePort = {
  async createPaymentIntent(_a, p) { const id = `pi_${++n}`; intents.set(id, { id, status: 'requires_payment_method', amount: p.amount, currency: p.currency, metadata: p.metadata, application_fee_amount: p.applicationFeeAmount }); return { id, clientSecret: `${id}_secret` }; },
  async retrievePaymentIntent(_a, id) { return intents.get(id)!; },
  async createRefund(a, p) { refunds.push({ a, ...p }); return { id: `re_${refunds.length}`, status: 'succeeded' }; },
};
const deps: any = { account: 'acct_1', seen: { markIfNew: async () => true }, orders: { byOrderCode: async () => null, setPaymentState: async () => {}, flagForReview: async () => {} }, checkout: { restrict: async () => {}, allow: async () => {} } };
const config = mergeConfig(testConfig, {
  authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'owner@example.com', password: 'long-random-pass' } },
  plugins: [CellPlugin.init({ stripe, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true, storeId: 'store_a', publishableKey: 'pk_test_x', checkoutGate: new MemGate(), controlSecret: 'c'.repeat(43) }, deps)],
});
const { server, adminClient, shopClient } = createTestEnvironment(config);
const URL = `http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`; const g = (s: string) => parse(s);
let x: ReturnType<typeof httpExec>;
before(async () => {
  await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/products.csv'), customerCount: 0 });
  await adminClient.asSuperAdmin(); await ensureTaxCategories((q, v) => adminClient.query(g(q), v));
  await adminClient.query(g(`mutation($i: CreatePaymentMethodInput!){ createPaymentMethod(input:$i){ id } }`), { i: { code: 'stripe-connect', enabled: true, handler: { code: 'stripe-connect', arguments: [] }, translations: [{ languageCode: 'en', name: 'Card' }] } });
});
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });

async function paidOrder() {
  await shopClient.asAnonymousUser();
  await shopClient.query(g(`mutation{ addItemToOrder(productVariantId: 1, quantity: 2){ __typename } }`));
  await shopClient.query(g(`mutation($i: CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`), { i: { emailAddress: 'maya@example.com', firstName: 'Maya', lastName: 'Lee' } });
  await shopClient.query(g(`mutation($i: CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename } }`), { i: { fullName: 'Maya Lee', streetLine1: '1 High St', city: 'Watford', postalCode: 'WD24 6SX', countryCode: 'GB' } });
  const m = await shopClient.query(g(`query{ eligibleShippingMethods{ id } }`));
  await shopClient.query(g(`mutation($id: [ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`), { id: [m.eligibleShippingMethods[0].id] });
  await shopClient.query(g(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename } }`));
  const s = (await shopClient.query(g(`mutation{ createPaymentSession{ paymentIntentId amount } }`))).createPaymentSession; intents.get(s.paymentIntentId)!.status = 'succeeded';
  const done = (await shopClient.query(g(`mutation($i: PaymentInput!){ addPaymentToOrder(input:$i){ __typename ... on Order { id state } } }`), { i: { method: 'stripe-connect', metadata: { paymentIntentId: s.paymentIntentId } } })).addPaymentToOrder;
  assert.equal(done.state, 'PaymentSettled'); return { id: String(done.id), total: s.amount as number };
}

test('sign-in: wrong password is refused, right one returns a bearer token', async () => {
  assert.equal(await engineLogin({ url: URL }, 'owner@example.com', 'nope'), null);
  const s = await engineLogin({ url: URL }, 'owner@example.com', 'long-random-pass'); assert.ok(s && s.token.length > 20); assert.equal(s!.identifier, 'owner@example.com');
  x = httpExec({ url: URL }, s!.token);
});
test('no session, no data: the engine refuses a call without a valid token', async () => {
  await assert.rejects(A.listOrders(httpExec({ url: URL }, 'not-a-token')), (e: unknown) => e instanceof EngineError && e.code === 'FORBIDDEN');
});
test('an unreachable engine is reported as such, not as empty data', async () => {
  await assert.rejects(A.listProducts(httpExec({ url: 'http://127.0.0.1:9/admin-api' }, 't')), (e: unknown) => e instanceof EngineError && e.code === 'UNREACHABLE');
});
test('products: the seeded product is listed with price as the customer pays it and real stock', async () => {
  const ps = await A.listProducts(x); const mug = ps.find(p => p.sku === 'MUG-1')!; assert.ok(mug); assert.equal(mug.title, 'Test Mug'); assert.equal(mug.status, 'published'); assert.equal(mug.onHand, 100); assert.equal(mug.variants, 1); assert.ok(mug.priceMinor >= 1000);
});
test('add product: created in the engine as a draft, duplicate SKU refused', async () => {
  const r = await A.addProduct(x, { title: 'Linen apron', priceMinor: 3400, sku: 'APR-1', status: 'draft', onHand: 6 }); assert.equal(r.ok, true, r.message);
  const p = (await A.listProducts(x)).find(q => q.sku === 'APR-1')!; assert.equal(p.status, 'draft'); assert.equal(p.onHand, 6);
  const d = await A.addProduct(x, { title: 'Another', priceMinor: 100, sku: 'APR-1', status: 'draft', onHand: 1 }); assert.equal(d.ok, false); assert.match(d.message, /already used/);
});
test('stock: set and add change the engine, and going below zero is refused', async () => {
  const id = (await A.listProducts(x)).find(q => q.sku === 'APR-1')!.id;
  assert.equal((await A.adjustStock(x, { productId: id, mode: 'set', qty: 10, reason: 'recount' })).ok, true); assert.equal((await A.adjustStock(x, { productId: id, mode: 'add', qty: 5, reason: 'received' })).ok, true);
  assert.equal((await A.getProduct(x, id))!.variantList[0].onHand, 15);
  const bad = await A.adjustStock(x, { productId: id, mode: 'add', qty: -99, reason: 'damaged' }); assert.equal(bad.ok, false); assert.match(bad.message, /below zero/);
});
test('variants: price, stock, VAT class and on-sale are saved; changing the option structure is refused, not half-applied', async () => {
  const id = (await A.listProducts(x)).find(q => q.sku === 'APR-1')!.id; const p = (await A.getProduct(x, id))!;
  const ok = await A.saveVariants(x, id, { optionGroups: p.optionGroups, variants: [{ options: [], sku: 'APR-1', priceMinor: 3600, stock: 20, taxClass: 'zero', enabled: false }] }); assert.equal(ok.ok, true, ok.message);
  const v = (await A.getProduct(x, id))!.variantList[0]; assert.equal(v.onHand, 20); assert.equal(v.taxClass, 'zero'); assert.equal(v.enabled, false); assert.equal(v.priceMinor, 3600);
  const no = await A.saveVariants(x, id, { optionGroups: [{ name: 'Size', options: ['S'] }], variants: [{ options: ['S'], sku: 'X', priceMinor: 1, stock: 1, taxClass: 'standard', enabled: true }] }); assert.equal(no.ok, false);
});
let order: { id: string; total: number };
test('orders: a paid order appears with customer, lines, totals and statuses; baskets do not', async () => {
  assert.equal((await A.listOrders(x)).length, 0); order = await paidOrder();
  const os = await A.listOrders(x); assert.equal(os.length, 1); const o = os[0];
  assert.equal(o.customer, 'Maya Lee'); assert.equal(o.email, 'maya@example.com'); assert.equal(o.totalMinor, order.total); assert.equal(o.payment, 'paid'); assert.equal(o.fulfilment, 'unfulfilled'); assert.equal(o.state, 'open');
  assert.equal(o.lines[0].sku, 'MUG-1'); assert.equal(o.lines[0].qty, 2); assert.equal(o.shippingMinor, 500); assert.match(o.shipTo, /Watford/); assert.equal(o.lines.reduce((s, l) => s + l.qty * l.unitMinor, 0) + o.shippingMinor, o.totalMinor);
  assert.equal((await A.listOrders(x, { filter: 'unfulfilled' })).length, 1); assert.equal((await A.listOrders(x, { filter: 'refunded' })).length, 0); assert.equal((await A.listOrders(x, { q: 'maya' })).length, 1); assert.equal((await A.listOrders(x, { q: 'nobody' })).length, 0);
  assert.equal((await A.listCustomers(x))[0].spentMinor, order.total);
});
test('fulfil: the engine records the fulfilment with tracking, the order completes, and a second attempt is refused', async () => {
  const r = await A.fulfilOrder(x, order.id, 'RM123'); assert.equal(r.ok, true, r.message);
  const o = (await A.getOrder(x, order.id))!; assert.equal(o.fulfilment, 'fulfilled'); assert.equal(o.state, 'completed'); assert.ok(o.timeline.some(t => /RM123/.test(t.text)));
  const again = await A.fulfilOrder(x, order.id); assert.equal(again.ok, false); assert.match(again.message, /already fulfilled/);
  assert.equal((await A.listProducts(x)).find(p => p.sku === 'MUG-1')!.onHand, 98, 'stock came down by the two sold');
});
test('refund: a partial refund goes through the payment handler on the merchant account, and over-refunding is refused', async () => {
  const r = await A.refundOrder(x, { orderId: order.id, amountMinor: 1000, reason: 'Damaged', restock: false, refundFee: true }); assert.equal(r.ok, true, r.message);
  assert.equal(refunds.length, 1); assert.equal(refunds[0].a, 'acct_1'); assert.equal(refunds[0].amount, 1000);
  const o = (await A.getOrder(x, order.id))!; assert.equal(o.payment, 'partially_refunded'); assert.equal(o.refundedMinor, 1000);
  const over = await A.refundOrder(x, { orderId: order.id, amountMinor: order.total, reason: 'x', restock: false, refundFee: true }); assert.equal(over.ok, false); assert.match(over.message, /refund up to/);
});
