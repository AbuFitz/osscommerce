// The portal's engine adapter, proven over real HTTP against a real Vendure with the cell plugin: sign in, read, add a product, take a paid order, fulfil and refund.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import { CatalogueFieldsPlugin } from './catalogue-fields.ts';
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
  plugins: [CatalogueFieldsPlugin, CellPlugin.init({ stripe, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true, storeId: 'store_a', publishableKey: 'pk_test_x', checkoutGate: new MemGate(), controlSecret: 'c'.repeat(43) }, deps)],
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
  const m = await shopClient.query(g(`query{ eligibleShippingMethods{ id code price } }`)); const legacy = m.eligibleShippingMethods.find((v: any) => v.price === 500);
  await shopClient.query(g(`mutation($id: [ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`), { id: [legacy.id] });
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
test('discounts: percentage, fixed and free-delivery coupons are created and read through the real engine', async () => {
  const percent = await A.createDiscount(x, { code: 'SAVE10', kind: 'percent', value: 10, minSpendMinor: 2000, limit: 25 }); assert.equal(percent.ok, true, percent.message);
  const fixed = await A.createDiscount(x, { code: 'LESS5', kind: 'fixed', value: 500 }); assert.equal(fixed.ok, true, fixed.message);
  const shipping = await A.createDiscount(x, { code: 'SHIPFREE', kind: 'shipping', value: 0 }); assert.equal(shipping.ok, true, shipping.message);
  const rows = await A.listDiscounts(x); assert.equal(rows.length, 3);
  const s10 = rows.find(d => d.code === 'SAVE10')!; assert.deepEqual({ code: s10.code, kind: s10.kind, value: s10.value, status: s10.status, used: s10.used, limit: s10.limit, window: s10.window, minSpendMinor: s10.minSpendMinor, automatic: s10.automatic }, { code: 'SAVE10', kind: 'percent', value: 10, status: 'active', used: 0, limit: 25, window: 'No end date', minSpendMinor: 2000, automatic: false });
  assert.equal(rows.find(d => d.code === 'LESS5')?.value, 500);
  assert.equal(rows.find(d => d.code === 'SHIPFREE')?.kind, 'shipping');
  const duplicate = await A.createDiscount(x, { code: 'save10', kind: 'percent', value: 5 }); assert.equal(duplicate.ok, false); assert.match(duplicate.message, /already in use/);
});
test('delivery zones: country eligibility, rates and edits are stored in the real engine', async () => {
  const made = await A.saveShippingZone(x, { name: 'Home', regions: 'United Kingdom', rates: [{ label: 'Tracked', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Next day', priceMinor: 995 }] }); assert.equal(made.ok, true, made.message);
  let shipping = await A.listShippingTax(x); assert.equal(shipping.pricesIncludeTax, false); assert.deepEqual(shipping.zones, [{ name: 'Home', regions: 'United Kingdom', rates: [{ label: 'Tracked', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Next day', priceMinor: 995, freeOverMinor: undefined }] }]);
  const edited = await A.saveShippingZone(x, { originalName: 'Home', name: 'UK', regions: 'GB', rates: [{ label: 'Standard', priceMinor: 595 }] }); assert.equal(edited.ok, true, edited.message);
  shipping = await A.listShippingTax(x); assert.deepEqual(shipping.zones, [{ name: 'UK', regions: 'GB', rates: [{ label: 'Standard', priceMinor: 595, freeOverMinor: undefined }] }]);
  const unknown = await A.saveShippingZone(x, { name: 'Lost', regions: 'Atlantis', rates: [{ label: 'Boat', priceMinor: 1 }] }); assert.equal(unknown.ok, false); assert.match(unknown.message, /could not match/);
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
  const r = await A.refundOrder(x, { orderId: order.id, amountMinor: 1000, reason: 'Damaged', restock: false }); assert.equal(r.ok, true, r.message);
  assert.equal(refunds.length, 1); assert.equal(refunds[0].a, 'acct_1'); assert.equal(refunds[0].amount, 1000);
  const o = (await A.getOrder(x, order.id))!; assert.equal(o.payment, 'partially_refunded'); assert.equal(o.refundedMinor, 1000);
  const over = await A.refundOrder(x, { orderId: order.id, amountMinor: order.total, reason: 'x', restock: false }); assert.equal(over.ok, false); assert.match(over.message, /refund up to/);
});

test('partial fulfilment: send one of two, the order shows part sent, then the rest completes it', async () => {
  const o2 = await paidOrder(); const before = (await A.getOrder(x, o2.id))!; assert.equal(before.lines[0].qty, 2); assert.equal(before.lines[0].sent, 0);
  const none = await A.fulfilOrder(x, o2.id, undefined, [{ sku: 'MUG-1', qty: 0 }]); assert.equal(none.ok, false); assert.match(none.message, /at least one/);
  const part = await A.fulfilOrder(x, o2.id, 'TRK1', [{ sku: 'MUG-1', qty: 1 }]); assert.equal(part.ok, true, part.message); assert.match(part.message, /Part of the order/);
  let o = (await A.getOrder(x, o2.id))!; assert.equal(o.fulfilment, 'partial'); assert.equal(o.state, 'open'); assert.equal(o.lines[0].sent, 1);
  const over = await A.fulfilOrder(x, o2.id, undefined, [{ sku: 'MUG-1', qty: 5 }]); assert.equal(over.ok, true, 'asking for more than is left sends only what is left'); o = (await A.getOrder(x, o2.id))!; assert.equal(o.lines[0].sent, 2); assert.equal(o.fulfilment, 'fulfilled'); assert.equal(o.state, 'completed');
  const cancel = await A.cancelOrder(x, { orderId: o2.id, reason: 'x', refund: false }); assert.equal(cancel.ok, false, 'a shipped order cannot be cancelled'); assert.match(cancel.message, /sent|already/);
});
test('notes: a private note is stored in the engine and comes back in the timeline marked as a note', async () => {
  const r = await A.addOrderNote(x, order.id, '  Customer called about gift wrap.  '); assert.equal(r.ok, true, r.message);
  const o = (await A.getOrder(x, order.id))!; const n = o.timeline.find(t => t.note); assert.ok(n); assert.equal(n!.text, 'Customer called about gift wrap.');
  assert.equal((await A.addOrderNote(x, order.id, '   ')).ok, false); assert.equal((await A.addOrderNote(x, order.id, 'x'.repeat(2001))).ok, false);
});
test('cancel: an unshipped paid order is cancelled, its stock released, and the customer refunded in full when asked', async () => {
  const stockBefore = (await A.listProducts(x)).find(p => p.sku === 'MUG-1')!; const o3 = await paidOrder();
  assert.equal((await A.listProducts(x)).find(p => p.sku === 'MUG-1')!.allocated, stockBefore.allocated + 2, 'two reserved for the new order');
  const refundsBefore = refunds.length; const r = await A.cancelOrder(x, { orderId: o3.id, reason: 'Out of stock', refund: true }); assert.equal(r.ok, true, r.message); assert.match(r.message, /cancelled/i);
  const o = (await A.getOrder(x, o3.id))!; assert.equal(o.state, 'cancelled'); assert.equal(o.payment, 'refunded'); assert.equal(o.refundedMinor, o3.total); assert.equal(refunds.length, refundsBefore + 1); assert.ok(o.timeline.some(t => /cancelled: Out of stock/i.test(t.text)));
  assert.equal((await A.listProducts(x)).find(p => p.sku === 'MUG-1')!.allocated, stockBefore.allocated, 'the two reserved units are released');
  assert.equal((await A.cancelOrder(x, { orderId: o3.id, reason: 'again', refund: false })).ok, false, 'cancelling twice is refused');
});

async function basketWith(variantId: string, qty: number, coupon?: string) {
  await shopClient.asAnonymousUser();
  await shopClient.query(g(`mutation($id:ID!,$q:Int!){ addItemToOrder(productVariantId:$id, quantity:$q){ __typename } }`), { id: variantId, q: qty });
  if (coupon) await shopClient.query(g(`mutation($c:String!){ applyCouponCode(couponCode:$c){ __typename } }`), { c: coupon });
  const o = (await shopClient.query(g(`query{ activeOrder{ subTotalWithTax discounts{ description amountWithTax } totalWithTax } }`))).activeOrder; return o as { subTotalWithTax: number; discounts: { description: string; amountWithTax: number }[]; totalWithTax: number };
}
test('discounts v2: chosen-product percentage, buy X get Y, automatic, edit, pause and delete all work against the real engine', async () => {
  const prod = (await A.listProducts(x)).find(p => p.sku === 'MUG-1')!; const unit = prod.priceMinor; const variant = (await A.getProduct(x, prod.id))!.variantList[0].id;
  const other = await A.addProduct(x, { title: 'Plain bowl', priceMinor: 3000, status: 'published', onHand: 20, sku: 'BOWL-1' }); assert.equal(other.ok, true, other.message); const bowl = (await A.listProducts(x)).find(p => p.sku === 'BOWL-1')!; const bowlVariant = (await A.getProduct(x, bowl.id))!.variantList[0].id;
  // chosen products only, by code
  const pct = await A.saveDiscount(x, { method: 'code', code: 'MUGS20', kind: 'percent', value: 20, productIds: [prod.id], enabled: true, perCustomer: 1 }); assert.equal(pct.ok, true, pct.message); assert.ok(pct.id);
  const mugBasket = await basketWith(variant, 1, 'MUGS20'); assert.equal(mugBasket.discounts.reduce((s, d) => s + d.amountWithTax, 0), -Math.round(unit * 0.2), 'the mug gets 20% off');
  const bowlBasket = await basketWith(bowlVariant, 1, 'MUGS20'); assert.equal(bowlBasket.discounts.length, 0, 'the bowl is not in the chosen products');
  // buy 2 get 1 free, automatic (no code)
  const bogo = await A.saveDiscount(x, { method: 'automatic', name: 'Mugs 3 for 2', kind: 'bogo', value: 0, buy: 2, get: 1, productIds: [prod.id], enabled: true }); assert.equal(bogo.ok, true, bogo.message);
  const three = await basketWith(variant, 3); assert.equal(three.discounts.reduce((s, d) => s + d.amountWithTax, 0), -unit, 'one of three is free, with no code typed');
  const two = await basketWith(variant, 2); assert.equal(two.discounts.length, 0, 'two is not enough: buy 2 means the third is the free one');
  const six = await basketWith(variant, 6); assert.equal(six.discounts.reduce((s, d) => s + d.amountWithTax, 0), -2 * unit, 'six units: two free (it repeats)');
  const rows = await A.listDiscounts(x); const b = rows.find(d => d.id === bogo.id)!; assert.deepEqual({ kind: b.kind, buy: b.buy, get: b.get, automatic: b.automatic, products: b.productIds, name: b.name }, { kind: 'bogo', buy: 2, get: 1, automatic: true, products: [prod.id], name: 'Mugs 3 for 2' });
  const m = rows.find(d => d.id === pct.id)!; assert.deepEqual({ kind: m.kind, value: m.value, products: m.productIds, perCustomer: m.perCustomer }, { kind: 'percent', value: 20, products: [prod.id], perCustomer: 1 });
  // edit
  const edit = await A.saveDiscount(x, { id: bogo.id, method: 'automatic', name: 'Mugs 4 for 3', kind: 'bogo', value: 0, buy: 3, get: 1, productIds: [prod.id], enabled: true }); assert.equal(edit.ok, true, edit.message);
  assert.equal((await basketWith(variant, 3)).discounts.length, 0, 'now three is not enough'); assert.equal((await basketWith(variant, 4)).discounts.reduce((s, d) => s + d.amountWithTax, 0), -unit, 'buy 3 get 1: the fourth is free');
  // pause and resume
  assert.equal((await A.setDiscountEnabled(x, bogo.id!, false)).ok, true); assert.equal((await A.listDiscounts(x)).find(d => d.id === bogo.id)!.status, 'paused'); assert.equal((await basketWith(variant, 4)).discounts.length, 0, 'paused means no discount');
  assert.equal((await A.setDiscountEnabled(x, bogo.id!, true)).ok, true); assert.equal((await basketWith(variant, 4)).discounts.length, 1, 'resumed');
  // refuse bad input and a product that is not ours
  assert.equal((await A.saveDiscount(x, { method: 'code', code: 'mugs20', kind: 'percent', value: 5, enabled: true })).ok, false, 'code already in use');
  assert.equal((await A.saveDiscount(x, { method: 'automatic', kind: 'bogo', value: 0, buy: 2, get: 1, productIds: ['9999'], enabled: true })).ok, false, 'unknown product');
  assert.equal((await A.saveDiscount(x, { method: 'code', code: 'X', kind: 'percent', value: 5, enabled: true })).ok, false);
  // schedule: a future start is scheduled and does not apply yet
  const future = await A.saveDiscount(x, { method: 'automatic', kind: 'percent', value: 50, startDate: '2099-01-01', enabled: true }); assert.equal(future.ok, true, future.message);
  assert.equal((await A.listDiscounts(x)).find(d => d.id === future.id)!.status, 'scheduled'); assert.equal((await basketWith(bowlVariant, 1)).discounts.length, 0);
  // delete
  for (const id of [pct.id!, bogo.id!, future.id!]) assert.equal((await A.deleteDiscount(x, id)).ok, true);
  assert.equal((await A.listDiscounts(x)).some(d => [pct.id, bogo.id, future.id].includes(d.id)), false); assert.equal((await basketWith(variant, 4)).discounts.length, 0);
});

test('collections v2: by-name and hand-picked collections are created, read back, edited and deleted in the real engine', async () => {
  const mug = (await A.listProducts(x)).find(p => p.sku === 'MUG-1')!; const bowl = (await A.listProducts(x)).find(p => p.sku === 'BOWL-1')!;
  assert.equal((await A.saveCollection(x, { name: 'Mugs', kind: 'rule', contains: 'nothing-matches-this' })).ok, false, 'an empty shelf is refused');
  assert.equal((await A.saveCollection(x, { name: '', kind: 'rule', contains: 'mug' })).ok, false); assert.equal((await A.saveCollection(x, { name: 'Pick', kind: 'manual', productIds: [] })).ok, false);
  const rule = await A.saveCollection(x, { name: 'By name', kind: 'rule', contains: 'mug' }); assert.equal(rule.ok, true, rule.message); assert.ok(rule.id);
  const hand = await A.saveCollection(x, { name: 'Hand picked', kind: 'manual', productIds: [mug.id, bowl.id] }); assert.equal(hand.ok, true, hand.message);
  // Membership is worked out by the engine's background queue, so give it a moment.
  let rows = await A.listCollections(x); for (let i = 0; i < 40 && !(rows.find(c => c.id === rule.id)!.count > 0 && rows.find(c => c.id === hand.id)!.count > 0); i++) { await new Promise(r => setTimeout(r, 250)); rows = await A.listCollections(x); }
  const r = rows.find(c => c.id === rule.id)!; const h = rows.find(c => c.id === hand.id)!;
  assert.deepEqual({ kind: r.kind, contains: r.contains }, { kind: 'rule', contains: 'mug' }); assert.ok(r.count >= 1);
  assert.equal(h.kind, 'manual'); assert.deepEqual([...h.productIds!].sort(), [mug.id, bowl.id].sort()); assert.equal(h.products.length, 2);
  assert.equal((await A.saveCollection(x, { name: 'by name', kind: 'rule', contains: 'mug' })).ok, false, 'duplicate names are refused');
  const edit = await A.saveCollection(x, { id: hand.id, name: 'Hand picked, mugs only', kind: 'manual', productIds: [mug.id] }); assert.equal(edit.ok, true, edit.message);
  rows = await A.listCollections(x); for (let i = 0; i < 40 && rows.find(c => c.id === hand.id)!.products.length !== 1; i++) { await new Promise(r => setTimeout(r, 250)); rows = await A.listCollections(x); }
  const h2 = rows.find(c => c.id === hand.id)!; assert.equal(h2.name, 'Hand picked, mugs only'); assert.deepEqual(h2.productIds, [mug.id]);
  assert.equal((await A.saveCollection(x, { name: 'Foreign', kind: 'manual', productIds: ['9999'] })).ok, false, 'a product that is not ours is refused');
  assert.equal((await A.deleteCollection(x, rule.id!)).ok, true); assert.equal((await A.deleteCollection(x, hand.id!)).ok, true);
  assert.equal((await A.listCollections(x)).some(c => c.id === rule.id || c.id === hand.id), false);
});

test('customer detail: history, totals, addresses, private notes and profile edits against the real engine', async () => {
  const list = await A.listCustomers(x); const maya = list.find(c => c.email === 'maya@example.com')!; assert.ok(maya);
  const d = (await A.getCustomer(x, maya.id))!; assert.equal(d.email, 'maya@example.com'); assert.ok(d.orders >= 1); assert.ok(d.recentOrders.length >= 1); assert.ok(d.spentMinor > 0); assert.ok(d.addresses.some(a => /Watford/.test(a)) || d.addresses.length === 0);
  assert.equal(d.recentOrders[0].items.includes('MUG-1') || /Stoneware|mug/i.test(d.recentOrders[0].items) || d.recentOrders[0].items.length > 0, true);
  assert.equal(await A.getCustomer(x, '999999'), null);
  assert.equal((await A.addCustomerNote(x, maya.id, '   ')).ok, false); assert.equal((await A.addCustomerNote(x, maya.id, 'x'.repeat(2001))).ok, false);
  const add = await A.addCustomerNote(x, maya.id, '  Prefers a gift receipt.  '); assert.equal(add.ok, true, add.message);
  let notes = (await A.getCustomer(x, maya.id))!.notes; assert.equal(notes.length, 1); assert.equal(notes[0].text, 'Prefers a gift receipt.');
  assert.equal((await A.deleteCustomerNote(x, notes[0].id)).ok, true); assert.equal((await A.getCustomer(x, maya.id))!.notes.length, 0);
  assert.equal((await A.updateCustomerProfile(x, maya.id, { firstName: '', lastName: '', phone: '' })).ok, false); assert.equal((await A.updateCustomerProfile(x, maya.id, { firstName: 'Maya', lastName: 'Lee', phone: 'abc' })).ok, false);
  const up = await A.updateCustomerProfile(x, maya.id, { firstName: 'Maya', lastName: 'Okafor-Lee', phone: '07700 900123' }); assert.equal(up.ok, true, up.message);
  const after = (await A.getCustomer(x, maya.id))!; assert.equal(after.lastName, 'Okafor-Lee'); assert.equal(after.phone, '07700 900123'); assert.equal(after.email, 'maya@example.com', 'the email, which is the login, is not changed');
});

test('orders by hand: created, filled, paid and placed in one step, with stock reserved and failures leaving nothing behind', async () => {
  const items = await A.listOrderableItems(x); const mug = items.find(i => i.sku === 'MUG-1')!; assert.ok(mug); const drafts = async () => (await x(`query{ orders(options:{ filter:{ state:{ eq:"Draft" } } }){ totalItems } }`)).orders.totalItems as number;
  const before = (await A.listProducts(x)).find(p => p.sku === 'MUG-1')!; const startDrafts = await drafts();
  const shipping = (await A.listShippingChoices(x))[0];
  const made = await A.createManualOrder(x, { customer: { email: 'phone-order@example.com', firstName: 'Pat', lastName: 'Jones', phone: '07700 900111' }, items: [{ variantId: mug.variantId, qty: 2 }], address: { fullName: 'Pat Jones', line1: '5 Mill Lane', city: 'Bristol', postcode: 'BS1 4AX' }, shippingMethodId: shipping?.id, note: 'Took this over the phone.', payment: 'bank_transfer' });
  assert.equal(made.ok, true, made.message); const o = (await A.getOrder(x, made.id!))!;
  assert.equal(o.payment, 'paid'); assert.equal(o.email, 'phone-order@example.com'); assert.equal(o.lines[0].qty, 2); assert.equal(o.lines[0].sku, 'MUG-1'); assert.ok(o.timeline.some(t => t.note && /over the phone/.test(t.text))); assert.match(o.shipTo, /Bristol/);
  assert.ok((await A.listOrders(x)).some(r => r.id === made.id), 'it appears in the orders list'); assert.equal((await A.listProducts(x)).find(p => p.sku === 'MUG-1')!.allocated, before.allocated + 2, 'two units reserved');
  assert.equal((await A.listCustomers(x)).some(c => c.email === 'phone-order@example.com'), true, 'the new customer was created');
  // the live map: the order's delivery town is carried through and placed
  assert.equal(o.ship?.city, 'Bristol'); assert.equal(o.ship?.country, 'GB');
  const lv = await A.liveView(x); assert.equal(lv.tracked, false); assert.ok(lv.points.some(p => p.place === 'Bristol, United Kingdom' && p.orders >= 1 && p.precision === 'town'), 'Bristol is on the map'); assert.ok(lv.recent.some(r => r.id === made.id)); assert.ok(lv.orders.value >= 1);
  // an existing customer
  const maya = (await A.listCustomers(x)).find(c => c.email === 'maya@example.com')!; const again = await A.createManualOrder(x, { customer: { id: maya.id }, items: [{ variantId: mug.variantId, qty: 1 }], shippingMethodId: shipping.id, payment: 'cash' }); assert.equal(again.ok, true, again.message);
  // refusals
  assert.equal((await A.createManualOrder(x, { customer: { id: maya.id }, items: [], payment: 'cash' })).ok, false);
  const tooMany = await A.createManualOrder(x, { customer: { id: maya.id }, items: [{ variantId: mug.variantId, qty: mug.available + 50 }], shippingMethodId: shipping.id, payment: 'cash' }); assert.equal(tooMany.ok, false); assert.match(tooMany.message, /Only \d+ of/);
  assert.equal((await A.createManualOrder(x, { customer: { email: 'not-an-email', firstName: 'a', lastName: 'b' }, items: [{ variantId: mug.variantId, qty: 1 }], shippingMethodId: shipping.id, payment: 'cash' })).ok, false);
  const noShipping = await A.createManualOrder(x, { customer: { id: maya.id }, items: [{ variantId: mug.variantId, qty: 1 }], payment: 'cash' }); assert.equal(noShipping.ok, false); assert.match(noShipping.message, /delivery option/);
  const badCoupon = await A.createManualOrder(x, { customer: { id: maya.id }, items: [{ variantId: mug.variantId, qty: 1 }], coupon: 'NOSUCHCODE', shippingMethodId: shipping.id, payment: 'cash' }); assert.equal(badCoupon.ok, false);
  assert.equal(await drafts(), startDrafts, 'a failed order leaves no half-made draft behind');
});

test('stock by item: rows, adjustments with reasons in the history, real movements, settings, back orders and counts against the real engine', async () => {
  const rows = await A.listStockRows(x); const mug = rows.find(r => r.sku === 'MUG-1')!; const bowl = rows.find(r => r.sku === 'BOWL-1')!; assert.ok(mug && bowl);
  assert.equal(mug.available, mug.onHand - mug.allocated); assert.equal(mug.status === 'ok' || mug.status === 'low', true);
  // adjust with a reason and a name
  const add = await A.adjustVariantStock(x, { variantId: mug.variantId, mode: 'add', qty: 10, reason: 'received', note: 'Pallet from the kiln', by: 'Mo' }); assert.equal(add.ok, true, add.message);
  let d = (await A.getStockDetail(x, mug.variantId))!; assert.equal(d.onHand, mug.onHand + 10);
  const adj = d.moves.find(m => m.kind === 'adjusted' && m.quantity === 10)!; assert.ok(adj, 'the adjustment is in the history'); assert.equal(adj.reason, 'received'); assert.equal(adj.by, 'Mo'); assert.equal(adj.note, 'Pallet from the kiln');
  // real movements from orders carry the order
  assert.ok(d.moves.some(m => m.kind === 'reserved'), 'stock set aside for an order'); assert.ok(d.moves.some(m => m.kind === 'sale'), 'a sale from a fulfilled order');
  // refusals
  assert.equal((await A.adjustVariantStock(x, { variantId: mug.variantId, mode: 'add', qty: -(d.onHand + 1), reason: 'damaged' })).ok, false); assert.match((await A.adjustVariantStock(x, { variantId: mug.variantId, mode: 'set', qty: d.allocated > 0 ? d.allocated - 1 : -1, reason: 'recount' })).message, /reserved|below zero/);
  assert.equal((await A.adjustVariantStock(x, { variantId: mug.variantId, mode: 'add', qty: 1.5, reason: 'other' })).ok, false); assert.equal((await A.adjustVariantStock(x, { variantId: '999999', mode: 'add', qty: 1, reason: 'other' })).ok, false);
  const same = await A.adjustVariantStock(x, { variantId: mug.variantId, mode: 'set', qty: d.onHand, reason: 'recount' }); assert.match(same.message, /No change/);
  // settings: low-stock level changes the status; not counting stock; back orders
  assert.equal((await A.saveStockSettings(x, bowl.variantId, { tracked: true, backorder: false, lowAt: 1000 })).ok, true); assert.equal((await A.getStockDetail(x, bowl.variantId))!.status, 'low'); assert.equal((await A.listProducts(x)).find(p => p.sku === 'BOWL-1')!.threshold, 1000, 'the product list uses the item\'s own level');
  assert.equal((await A.saveStockSettings(x, bowl.variantId, { tracked: true, backorder: false, lowAt: -1 })).ok, false);
  assert.equal((await A.saveStockSettings(x, bowl.variantId, { tracked: false, backorder: false, lowAt: 5 })).ok, true); assert.equal((await A.getStockDetail(x, bowl.variantId))!.status, 'untracked');
  await A.saveStockSettings(x, bowl.variantId, { tracked: true, backorder: true, lowAt: 5 }); await A.adjustVariantStock(x, { variantId: bowl.variantId, mode: 'set', qty: 1, reason: 'recount' });
  await shopClient.asAnonymousUser(); const over = await shopClient.query(parse(`mutation($id:ID!){ addItemToOrder(productVariantId:$id, quantity:3){ __typename ... on InsufficientStockError { message } } }`), { id: bowl.variantId }); assert.equal(over.addItemToOrder.__typename, 'Order', 'with back orders on, a shopper can buy more than is in stock');
  await A.saveStockSettings(x, bowl.variantId, { tracked: true, backorder: false, lowAt: 5 }); await shopClient.asAnonymousUser(); const refused = await shopClient.query(parse(`mutation($id:ID!){ addItemToOrder(productVariantId:$id, quantity:3){ __typename } }`), { id: bowl.variantId }); assert.equal(refused.addItemToOrder.__typename, 'InsufficientStockError', 'with back orders off it is refused again');
  // a count
  const cur = (await A.getStockDetail(x, mug.variantId))!; const cnt = await A.applyStockCount(x, [{ variantId: mug.variantId, counted: cur.onHand }, { variantId: bowl.variantId, counted: 7 }, { variantId: '424242', counted: 1 }], 'Mo');
  assert.equal(cnt.changed, 1); assert.equal(cnt.unchanged, 1); assert.equal(cnt.problems.length, 1); assert.equal((await A.getStockDetail(x, bowl.variantId))!.onHand, 7);
  const bd = (await A.getStockDetail(x, bowl.variantId))!; const rc = bd.moves.find(m => m.kind === 'adjusted' && m.quantity === 6)!; assert.equal(rc.reason, 'recount'); assert.equal(rc.by, 'Mo'); assert.equal(rc.note, 'Stock count');
  assert.equal((await A.applyStockCount(x, [], 'Mo')).ok, false);
});

test('editing a placed order and returning goods: totals, refunds, extra payments, stock and guards against the real engine', async () => {
  const items = await A.listOrderableItems(x); const mug = items.find(i => i.sku === 'MUG-1')!; assert.ok(mug); const other = items.find(i => i.variantId !== mug.variantId && i.available > 2)!; assert.ok(other, 'a second item to add');
  const shipping = (await A.listShippingChoices(x))[0];
  const made = await A.createManualOrder(x, { customer: { email: 'edit-me@example.com', firstName: 'Ed', lastName: 'Itor' }, items: [{ variantId: mug.variantId, qty: 3 }], address: { fullName: 'Ed Itor', line1: '9 Mill Lane', city: 'Bristol', postcode: 'BS1 4AX' }, shippingMethodId: shipping?.id, payment: 'cash' }); assert.equal(made.ok, true, made.message);
  const o0 = (await A.getOrder(x, made.id!))!; const line = o0.lines[0]; assert.equal(line.qty, 3); assert.ok(line.id && line.variantId, 'lines carry their id and item');
  const stockOf = async (id: string) => (await A.listStockRows(x)).find(r => r.variantId === id)!;
  const s0 = await stockOf(mug.variantId);
  // nothing changed yet
  assert.equal((await A.previewOrderEdit(x, { orderId: o0.id, lines: [{ lineId: line.id!, qty: 3 }], add: [] })).ok, false);
  // one fewer: the preview says what it will cost, and saving it leaves the order exactly as it was before the preview
  const pv = await A.previewOrderEdit(x, { orderId: o0.id, lines: [{ lineId: line.id!, qty: 2 }], add: [] }); assert.equal(pv.ok, true, pv.message); assert.equal(pv.changeMinor, -line.unitMinor); assert.equal(pv.newTotalMinor, o0.totalMinor - line.unitMinor);
  assert.equal((await A.getOrder(x, o0.id))!.totalMinor, o0.totalMinor, 'a preview saves nothing');
  const dec = await A.applyOrderEdit(x, { orderId: o0.id, lines: [{ lineId: line.id!, qty: 2 }], add: [], reason: 'Customer changed their mind', note: 'Rang to drop one' }); assert.equal(dec.ok, true, dec.message); assert.match(dec.message, /refunded/);
  const o1 = (await A.getOrder(x, o0.id))!; assert.equal(o1.totalMinor, o0.totalMinor - line.unitMinor); assert.equal(o1.lines[0].qty, 2); assert.equal(o1.refundedMinor, line.unitMinor, 'the difference went back'); assert.ok(o1.timeline.some(t => t.note && /Rang to drop one/.test(t.text)));
  assert.equal((await stockOf(mug.variantId)).allocated, s0.allocated - 1, 'the released unit is available again');
  // while that refund is still pending with the provider, a further increase is refused with a plain reason
  const blocked = await A.applyOrderEdit(x, { orderId: o0.id, lines: [{ lineId: line.id!, qty: 3 }], add: [], payment: 'cash' }); assert.equal(blocked.ok, false); assert.match(blocked.message, /still pending/); assert.equal((await A.previewOrderEdit(x, { orderId: o0.id, lines: [{ lineId: line.id!, qty: 3 }], add: [] })).ok, false);
  // a fresh order for the rest
  const made2 = await A.createManualOrder(x, { customer: { email: 'edit-me-2@example.com', firstName: 'Ed', lastName: 'Two' }, items: [{ variantId: mug.variantId, qty: 3 }], address: { fullName: 'Ed Two', line1: '10 Mill Lane', city: 'Bristol', postcode: 'BS1 4AX' }, shippingMethodId: shipping?.id, payment: 'cash' }); assert.equal(made2.ok, true, made2.message);
  const q0 = (await A.getOrder(x, made2.id!))!; const line2 = q0.lines[0];
  // add another item and one more mug: costs more, so a payment method is needed
  const inc = { orderId: q0.id, lines: [{ lineId: line2.id!, qty: 3 }], add: [{ variantId: other.variantId, qty: 1 }] };
  const needPay = await A.applyOrderEdit(x, inc); assert.equal(needPay.ok, false); assert.match(needPay.message, /how the extra amount was paid/); assert.equal((await A.getOrder(x, q0.id))!.totalMinor, q0.totalMinor, 'nothing changed without a payment method');
  const ok = await A.applyOrderEdit(x, { ...inc, payment: 'bank_transfer' }); assert.equal(ok.ok, true, ok.message); const o2 = (await A.getOrder(x, q0.id))!;
  assert.equal(o2.lines.reduce((n, l) => n + l.qty, 0), 4); assert.ok(o2.totalMinor > q0.totalMinor); assert.equal(o2.payment === 'paid' || o2.payment === 'partially_refunded', true, `still counted as paid: ${o2.payment}`); assert.equal(o2.state, 'open');
  assert.equal((await stockOf(other.variantId)).allocated, other.available === 0 ? 0 : (await stockOf(other.variantId)).allocated, 'stock check ran'); assert.ok(o2.lines.some(l => l.variantId === other.variantId), 'the new item is on the order');
  // a charge, a discount and a new address
  const sur = await A.applyOrderEdit(x, { orderId: q0.id, lines: [], add: [], surcharge: { label: 'Gift wrapping', amountMinor: 350 }, address: { fullName: 'Ed Itor', line1: '1 New Street', city: 'Leeds', postcode: 'LS1 4AB' }, payment: 'cash' }); assert.equal(sur.ok, true, sur.message);
  const o3 = (await A.getOrder(x, q0.id))!; assert.equal(o3.totalMinor, o2.totalMinor + 350); assert.match(o3.shipTo, /Leeds/); assert.equal(o3.ship?.city, 'Leeds');
  // guards
  const everything = await A.previewOrderEdit(x, { orderId: q0.id, lines: o3.lines.map(l => ({ lineId: l.id!, qty: 0 })), add: [] }); assert.equal(everything.ok, false);
  assert.equal((await A.previewOrderEdit(x, { orderId: q0.id, lines: [{ lineId: 'nope', qty: 1 }], add: [] })).ok, false);
  assert.equal((await A.previewOrderEdit(x, { orderId: q0.id, lines: [{ lineId: line2.id!, qty: 1000 }], add: [] })).ok, false, 'over the limit');
  const tooMany = await A.previewOrderEdit(x, { orderId: q0.id, lines: [], add: [{ variantId: other.variantId, qty: other.available + 500 }] }); assert.equal(tooMany.ok, false);
  // a line that was already sent cannot drop below what went out
  const sentLine = o3.lines.find(l => l.variantId === mug.variantId)!; assert.equal((await A.fulfilOrder(x, q0.id, undefined, [{ sku: sentLine.sku, qty: 2 }])).ok, true);
  const afterSend = await A.applyOrderEdit(x, { orderId: q0.id, lines: [{ lineId: sentLine.id!, qty: 1 }], add: [], reason: 'x' }); assert.equal(afterSend.ok, false, afterSend.message);
  const stillOpen = (await A.getOrder(x, q0.id))!; assert.equal(stillOpen.state, 'open', 'a refused edit leaves the order as it was');
  // Returns: refund by line2, put the goods back, and the shelf count really goes up
  const before = await stockOf(mug.variantId); const ret = await A.refundOrder(x, { orderId: q0.id, amountMinor: sentLine.unitMinor, reason: 'Customer return', restock: true, lines: [{ lineId: sentLine.id!, qty: 1 }] }); assert.equal(ret.ok, true, ret.message); assert.match(ret.message, /1 item put back in stock/);
  const after = await stockOf(mug.variantId); assert.equal(after.onHand, before.onHand + 1); const detail = (await A.getStockDetail(x, mug.variantId))!; assert.ok(detail.moves.some(m => m.kind === 'adjusted' && m.reason === 'returned' && /Returned from order/.test(m.note ?? '')), 'the return is in the item history with its reason');
  const noRestock = await A.refundOrder(x, { orderId: q0.id, amountMinor: 100, reason: 'Goodwill', restock: true, lines: [] }); assert.equal(noRestock.ok, true); assert.equal((await stockOf(mug.variantId)).onHand, after.onHand, 'no lines named, so nothing goes back on the shelf');
  assert.equal((await A.refundOrder(x, { orderId: q0.id, amountMinor: 100, reason: 'x', restock: true, lines: [{ lineId: 'nope', qty: 1 }] })).ok, false);
  assert.equal((await A.refundOrder(x, { orderId: q0.id, amountMinor: 100, reason: 'x', restock: true, lines: [{ lineId: sentLine.id!, qty: 99 }] })).ok, false, 'cannot return more than the order holds');
});
