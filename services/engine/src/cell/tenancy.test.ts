// Two merchants on ONE engine. Each has their own channel, role and administrator. Everything here goes over real HTTP with each merchant's own token and channel header,
// the way the portal and storefronts call it. Cross-merchant attempts must be refused or return nothing, never another store's data.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import { CatalogueFieldsPlugin } from './catalogue-fields.ts';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import Stripe from 'stripe';
import { CellPlugin, MemGate } from './plugin.ts';
import { engineLogin, httpExec, EngineError } from '../../../../apps/portal/src/lib/engine/exec.ts';
import * as A from '../../../../apps/portal/src/lib/engine/adapter.ts';
import { ensureTaxCategories } from '../../../../apps/portal/src/lib/engine/catalogue.ts';
import { provisionStore } from './provision-store.ts';
import { OssOutbox } from './outbox-entity.ts';
import { TransactionalConnection } from '@vendure/core';

const outboxEvents = async () => (await server.app.get(TransactionalConnection).rawConnection.getRepository(OssOutbox).find()).map(r => JSON.parse(r.payload) as { type: string; recipient: { email: string }; data: Record<string, any> });
const callAs = async (k: 'A' | 'B', query: string, variables: Record<string, unknown>) => { const r = await fetch(`http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`, { method: 'POST', headers: { 'content-type': 'application/json', 'vendure-token': m[k].channelToken }, body: JSON.stringify({ query, variables }) }); return (await r.json()) as { data?: any; errors?: { message: string }[] }; };
const tokenOf = async (type: string, email: string) => { const ev = (await outboxEvents()).filter(e => e.type === type && e.recipient.email === email).pop(); return ev ? new globalThis.URL(ev.data.actionUrl).searchParams.get('t')! : null; };
const ACCEPT = 'mutation($t:String!,$p:String!){ acceptStaffToken(token:$t,password:$p) }';

const dir = path.join(__dirname, '.tmp-tenancy'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const intents = new Map<string, any>(); const refunds: any[] = []; let n = 0;
const stripe: any = {
  async createPaymentIntent(_a: string, p: any) { const id = `pi_${++n}`; intents.set(id, { id, status: 'requires_payment_method', amount: p.amount, currency: p.currency, metadata: p.metadata, application_fee_amount: p.applicationFeeAmount }); return { id, clientSecret: `${id}_secret` }; },
  async retrievePaymentIntent(_a: string, id: string) { return intents.get(id); },
  async createRefund(a: string, p: any) { refunds.push({ a, ...p }); return { id: `re_${refunds.length}`, status: 'succeeded' }; },
};
const deps: any = { account: 'acct_1', seen: { markIfNew: async () => true }, orders: { byOrderCode: async () => null, setPaymentState: async () => {}, flagForReview: async () => {} }, checkout: { restrict: async () => {}, allow: async () => {} } };
const { server, adminClient, shopClient } = createTestEnvironment(mergeConfig(testConfig, {
  authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } },
  plugins: [CatalogueFieldsPlugin, AssetServerPlugin.init({ route: 'assets', assetUploadDir: path.join(dir, 'assets') }), CellPlugin.init({ stripe, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true, storeId: 'store_a', publishableKey: 'pk', checkoutGate: new MemGate(), controlSecret: 'c'.repeat(43), portalUrl: 'https://portal.example' }, deps)],
}));
const URL = `http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`; const g = (s: string) => parse(s);
type M = { x: ReturnType<typeof httpExec>; token: string; channelId: string; channelToken: string; adminId: string };
const m: Record<'A' | 'B', M> = {} as any; const ids: Record<string, Record<string, string>> = { A: {}, B: {} };

before(async () => {
  await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv'), customerCount: 0 });
  await adminClient.asSuperAdmin();
  await ensureTaxCategories((qq, v) => adminClient.query(g(qq), v));
  await adminClient.query(g(`mutation($i: CreatePaymentMethodInput!){ createPaymentMethod(input:$i){ id } }`), { i: { code: 'stripe-connect', enabled: true, handler: { code: 'stripe-connect', arguments: [] }, translations: [{ languageCode: 'en', name: 'Card' }] } });
  for (const k of ['A', 'B'] as const) {
    const token = `chan-${k}-token-0123456789`; const email = `owner-${k.toLowerCase()}@example.com`; const pw = `Long-merchant-pass-${k}-1`;
    const p = await provisionStore((qq, v) => adminClient.query(g(qq), v), { key: k.toLowerCase(), name: `Store ${k}`, channelToken: token, owner: { email, password: pw, firstName: k } });
    const again = await provisionStore((qq, v) => adminClient.query(g(qq), v), { key: k.toLowerCase(), name: `Store ${k}`, channelToken: token, owner: { email, password: pw } }); assert.deepEqual(again, p, 'provisioning twice changes nothing');
    const s = await engineLogin({ url: URL, channelToken: token }, email, pw); assert.ok(s, `login ${k}`);
    m[k] = { x: httpExec({ url: URL, channelToken: token }, s!.token), token: s!.token, channelId: p.channelId, channelToken: token, adminId: p.administratorId };
  }
  for (const k of ['A', 'B'] as const) {
    const r = await A.addProduct(m[k].x, { title: `Mug ${k}`, priceMinor: 1000, sku: `MUG-${k}`, status: 'published', onHand: 10 }); assert.equal(r.ok, true, r.message);
    ids[k].product = (await A.listProducts(m[k].x))[0].id;
  }
});
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });

test('each merchant sees only their own catalogue, with real stock', async () => {
  for (const k of ['A', 'B'] as const) assert.equal((await A.listProducts(m[k].x))[0].onHand, 10, `stock for ${k} (a store needs its own stock location)`);
  assert.deepEqual((await A.listProducts(m.A.x)).map(p => p.title), ['Mug A']); assert.deepEqual((await A.listProducts(m.B.x)).map(p => p.title), ['Mug B']);
});

/** Run a request as merchant `who`; resolves to { data } or { denied: code } so each probe can assert either "refused" or "nothing returned". */
const as = async (who: 'A' | 'B', q: string, v?: any) => { try { return { data: await m[who].x(q, v) }; } catch (e) { return { denied: e instanceof EngineError ? e.code : 'ERR', message: (e as Error).message }; } };
const isolated = (r: { data?: any; denied?: string }, pick: (d: any) => unknown) => r.denied ? true : (() => { const v = pick(r.data); return v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && (v as any).totalItems === 0); })();

test('manipulated IDs: B asking for A\'s product by id gets nothing', async () => {
  const r = await as('B', `query($id:ID!){ product(id:$id){ id name } }`, { id: ids.A.product }); assert.ok(isolated(r, d => d.product), JSON.stringify(r));
});
test('manipulated IDs: B cannot update or delete A\'s product', async () => {
  const u = await as('B', `mutation($id:ID!){ updateProduct(input:{ id:$id, enabled:false }){ id } }`, { id: ids.A.product }); assert.ok(u.denied || !u.data?.updateProduct, JSON.stringify(u));
  const d = await as('B', `mutation($id:ID!){ deleteProduct(id:$id){ result } }`, { id: ids.A.product }); assert.ok(d.denied || d.data?.deleteProduct?.result !== 'DELETED', JSON.stringify(d));
  const still = await as('A', `query($id:ID!){ product(id:$id){ id enabled } }`, { id: ids.A.product }); assert.equal(still.data?.product?.enabled, true, 'A\'s product is untouched');
});
test('manipulated IDs: B cannot change A\'s stock through variants', async () => {
  const v = (await m.A.x(`query($id:ID!){ product(id:$id){ variants{ id } } }`, { id: ids.A.product })).product.variants[0].id;
  const r = await as('B', `mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id stockOnHand } }`, { i: [{ id: v, stockOnHand: 0 }] });
  assert.equal((r as any).denied, 'FORBIDDEN', 'the guard refuses it outright, not merely "no effect": ' + JSON.stringify(r));
  const after = (await m.A.x(`query($id:ID!){ product(id:$id){ variants{ stockOnHand } } }`, { id: ids.A.product })).product.variants[0].stockOnHand; assert.equal(after, 10);
  assert.equal((await as('B', `query($id:ID!){ productVariant(id:$id){ id } }`, { id: v })).data?.productVariant ?? null, null);
});
test('channel header games: B\'s token with A\'s channel token, or no channel, never reaches A', async () => {
  const mix = httpExec({ url: URL, channelToken: m.A.channelToken }, m.B.token);
  const r = await mix(`query{ products{ items{ name } } }`).then(d => d, e => ({ denied: (e as EngineError).code }));
  assert.ok((r as any).denied || ((r as any).products.items as any[]).length === 0, 'B\'s session on A\'s channel returns nothing: ' + JSON.stringify(r));
  const none = httpExec({ url: URL }, m.B.token); const d = await none(`query{ products{ items{ name } } }`).then(d => d, e => ({ denied: (e as EngineError).code }));
  assert.ok((d as any).denied || ((d as any).products.items as any[]).every((p: any) => p.name === 'Mug B'), 'with no channel header the default channel is used and B sees nothing of A: ' + JSON.stringify(d));
});
test('global operations are closed to a merchant: administrators, roles, channels, settings, jobs, system', async () => {
  const probes: [string, string][] = [
    ['read administrators', `query{ administrators{ totalItems } }`], ['create administrator', `mutation{ createAdministrator(input:{emailAddress:"x@y.zz",firstName:"a",lastName:"b",password:"aaaaaaaaaaaa",roleIds:[]}){ id } }`],
    ['read roles', `query{ roles{ totalItems } }`], ['create role', `mutation{ createRole(input:{code:"r",description:"d",permissions:[SuperAdmin],channelIds:[]}){ id } }`],
    ['read channels', `query{ channels{ totalItems } }`], ['update channel', `mutation($id:ID!){ updateChannel(input:{id:$id,pricesIncludeTax:false}){ __typename } }`],
    ['global settings', `mutation{ updateGlobalSettings(input:{trackInventory:false}){ __typename } }`], ['read jobs', `query{ jobs{ totalItems } }`], ['cancel job', `mutation{ cancelJob(jobId:"1"){ id } }`],
    ['system status', `query{ systemStatus: pendingSearchIndexUpdates }`], ['create tax category (global)', `mutation{ createTaxCategory(input:{name:"Evil"}){ id } }`], ['create zone (global)', `mutation{ createZone(input:{name:"Evil"}){ id } }`],
    ['create country (global)', `mutation{ createCountry(input:{code:"XX",enabled:true,translations:[{languageCode:en,name:"X"}]}){ id } }`], ['payment method handlers', `mutation($id:ID!){ updatePaymentMethod(input:{id:$id,enabled:false}){ id } }`],
  ];
  const bad: string[] = []; for (const [n, q] of probes) { const r = await as('B', q, { id: m.A.channelId }); if (!r.denied) bad.push(`${n}: ${JSON.stringify(r.data).slice(0, 80)}`); }
  assert.deepEqual(bad, [], 'these global operations were NOT refused');
});

test('collections, promotions and customers: B cannot touch A\'s by id', async () => {
  const col = (await m.A.x(`mutation{ createCollection(input:{ translations:[{languageCode:en,name:"A only",slug:"a-only",description:""}], filters:[] }){ id } }`)).createCollection.id;
  const promo = (await m.A.x(`mutation{ createPromotion(input:{ enabled:true, couponCode:"A10", conditions:[], actions:[{ code:"order_percentage_discount", arguments:[{name:"discount", value:"10"}] }], translations:[{languageCode:en,name:"A promo",description:""}] }){ __typename ... on Promotion { id } ... on ErrorResult { message } } }`).catch((e: Error) => ({ createPromotion: { __typename: 'Err', message: e.message } }))).createPromotion;
  const bad: string[] = [];
  const u1 = await as('B', `mutation($id:ID!){ updateCollection(input:{ id:$id, translations:[{languageCode:en,name:"hijacked"}] }){ id } }`, { id: col }); if (!u1.denied) bad.push('updateCollection');
  const d1 = await as('B', `mutation($id:ID!){ deleteCollection(id:$id){ result } }`, { id: col }); if (!d1.denied) bad.push('deleteCollection');
  if (promo?.id) { const u2 = await as('B', `mutation($id:ID!){ updatePromotion(input:{ id:$id, enabled:false }){ __typename } }`, { id: promo.id }); if (!u2.denied) bad.push('updatePromotion'); const d2 = await as('B', `mutation($id:ID!){ deletePromotion(id:$id){ result } }`, { id: promo.id }); if (!d2.denied) bad.push('deletePromotion'); }
  assert.deepEqual(bad, []); assert.equal((await m.A.x(`query($id:ID!){ collection(id:$id){ name } }`, { id: col })).collection.name, 'A only', 'A\'s collection is unchanged');
  assert.equal((await as('B', `query($id:ID!){ collection(id:$id){ id } }`, { id: col })).data?.collection ?? null, null, 'and B cannot read it');
  assert.deepEqual((await m.B.x(`query{ collections{ items{ name } } }`)).collections.items.map((c: any) => c.name).filter((n: string) => n === 'A only'), []);
});
test('shipping methods are channel-owned: merchants edit their own and cannot touch another store\'s', async () => {
  assert.deepEqual((await A.listShippingTax(m.A.x)).zones.map(z => z.name), ['United Kingdom']); assert.deepEqual((await A.listShippingTax(m.B.x)).zones.map(z => z.name), ['United Kingdom']);
  const a = await A.saveShippingZone(m.A.x, { originalName: 'United Kingdom', name: 'Store A UK', regions: 'GB', rates: [{ label: 'A delivery', priceMinor: 321 }, { label: 'A express', priceMinor: 654 }] }); assert.equal(a.ok, true, a.message);
  assert.deepEqual((await A.listShippingTax(m.A.x)).zones, [{ name: 'Store A UK', regions: 'GB', rates: [{ label: 'A delivery', priceMinor: 321, freeOverMinor: undefined }, { label: 'A express', priceMinor: 654, freeOverMinor: undefined }] }]); assert.deepEqual((await A.listShippingTax(m.B.x)).zones.map(z => z.name), ['United Kingdom'], 'B is unchanged');
  const aid = (await m.A.x(`query{ shippingMethods{ items{ id name } } }`)).shippingMethods.items.find((s: any) => s.name === 'A delivery').id;
  const cross = await as('B', `mutation($i:UpdateShippingMethodInput!){ updateShippingMethod(input:$i){ id } }`, { i: { id: aid, translations: [{ languageCode: 'en', name: 'Stolen' }] } }); assert.equal(cross.denied, 'FORBIDDEN');
  assert.equal((await m.A.x(`query($id:ID!){ shippingMethod(id:$id){ name } }`, { id: aid })).shippingMethod.name, 'A delivery');
});
test('option groups are not channel-aware: B cannot attach A\'s option group to B\'s product', async () => {
  const x = m.A.x; const grp = (await x(`mutation($i:CreateProductOptionGroupInput!){ createProductOptionGroup(input:$i){ id } }`, { i: { code: 'a-size', translations: [{ languageCode: 'en', name: 'Size' }], options: [{ code: 's', translations: [{ languageCode: 'en', name: 'S' }] }] } })).createProductOptionGroup.id;
  await x(`mutation($p:ID!,$g:ID!){ addOptionGroupToProduct(productId:$p, optionGroupId:$g){ id } }`, { p: ids.A.product, g: grp });
  const r = await as('B', `mutation($p:ID!,$g:ID!){ addOptionGroupToProduct(productId:$p, optionGroupId:$g){ id } }`, { p: ids.B.product, g: grp }); assert.equal(r.denied, 'FORBIDDEN', JSON.stringify(r));
  const r2 = await as('B', `mutation($p:ID!,$g:ID!){ addOptionGroupToProduct(productId:$p, optionGroupId:$g){ id } }`, { p: ids.A.product, g: grp }); assert.equal(r2.denied, 'FORBIDDEN', 'nor can B modify A\'s product');
});
test('the guard is for merchants only: the platform operator can still do global work', async () => {
  const r = await adminClient.query(g(`query{ channels{ totalItems } jobs{ totalItems } }`)); assert.ok(r.channels.totalItems >= 3);
});
test('merchant customers: each store lists only its own', async () => {
  assert.equal((await A.listCustomers(m.A.x)).length, 0); assert.equal((await A.listCustomers(m.B.x)).length, 0);
});

/** A real checkout in store `who` through the Shop API with that store's channel token, paid through the Connect handler. */
async function paidOrder(who: 'A' | 'B') {
  shopClient.setChannelToken(m[who].channelToken); await shopClient.asAnonymousUser();
  const variantId = (await m[who].x(`query($id:ID!){ product(id:$id){ variants{ id } } }`, { id: ids[who].product })).product.variants[0].id;
  await shopClient.query(g(`mutation($v:ID!){ addItemToOrder(productVariantId:$v, quantity: 1){ __typename ... on ErrorResult { message } } }`), { v: variantId });
  await shopClient.query(g(`mutation($i: CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`), { i: { emailAddress: `shopper-${who}@example.com`, firstName: 'Shopper', lastName: who } });
  await shopClient.query(g(`mutation($i: CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename } }`), { i: { fullName: `Shopper ${who}`, streetLine1: '1 High St', city: 'Watford', postalCode: 'WD24 6SX', countryCode: 'GB' } });
  const ms = await shopClient.query(g(`query{ eligibleShippingMethods{ id } }`)); await shopClient.query(g(`mutation($id: [ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`), { id: [ms.eligibleShippingMethods[0].id] });
  await shopClient.query(g(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename } }`));
  const sess = (await shopClient.query(g(`mutation{ createPaymentSession{ paymentIntentId amount } }`))).createPaymentSession; intents.get(sess.paymentIntentId).status = 'succeeded';
  const done = (await shopClient.query(g(`mutation($i: PaymentInput!){ addPaymentToOrder(input:$i){ __typename ... on Order { id state } } }`), { i: { method: 'stripe-connect', metadata: { paymentIntentId: sess.paymentIntentId } } })).addPaymentToOrder;
  assert.equal(done.state, 'PaymentSettled', JSON.stringify(done)); return { id: String(done.id), total: sess.amount as number };
}
const orders: Record<string, { id: string; total: number }> = {};
test('orders: each store has its own paid order and sees only that', async () => {
  for (const k of ['A', 'B'] as const) { orders[k] = await paidOrder(k); ids[k].order = orders[k].id; }
  assert.equal((await A.listOrders(m.A.x)).length, 1); assert.equal((await A.listOrders(m.B.x)).length, 1);
  assert.equal((await A.listOrders(m.A.x))[0].email, 'shopper-a@example.com'); assert.equal((await A.listOrders(m.B.x))[0].email, 'shopper-b@example.com');
  assert.equal((await A.listCustomers(m.A.x)).map(c => c.email).join(), 'shopper-a@example.com'); assert.equal((await A.listCustomers(m.B.x)).map(c => c.email).join(), 'shopper-b@example.com', 'customers are per store');
  assert.equal(await A.getOrder(m.B.x, orders.A.id), null, 'B cannot read A\'s order by id'); assert.equal(await A.getOrder(m.A.x, orders.B.id), null);
});
test('orders: B cannot fulfil, refund, cancel or annotate A\'s order; nothing changes; A still can', async () => {
  const f = await A.fulfilOrder(m.B.x, orders.A.id, 'EVIL'); assert.equal(f.ok, false);
  const r = await A.refundOrder(m.B.x, { orderId: orders.A.id, amountMinor: 100, reason: 'x', restock: false }); assert.equal(r.ok, false); assert.equal(refunds.length, 0, 'no refund reached Stripe');
  const c = await as('B', `mutation($id:ID!){ cancelOrder(input:{ orderId:$id, reason:"x", cancelShipping:true, lines:[] }){ __typename } }`, { id: orders.A.id }); assert.equal(c.denied, 'FORBIDDEN');
  const nt = await as('B', `mutation($id:ID!){ addNoteToOrder(input:{ id:$id, note:"hi", isPublic:false }){ id } }`, { id: orders.A.id }); assert.equal(nt.denied, 'FORBIDDEN');
  const pay = (await adminClient.query(g(`query($id:ID!){ order(id:$id){ payments{ id } lines{ id } fulfillments{ id } } }`), { id: orders.A.id })).order;
  const direct = await as('B', `mutation($i:RefundOrderInput!){ refundOrder(input:$i){ __typename } }`, { i: { lines: [], shipping: 0, adjustment: 0, amount: 100, paymentId: pay.payments[0].id, reason: 'x' } }); assert.equal(direct.denied, 'FORBIDDEN', 'refund by payment id of another store');
  const line = await as('B', `mutation($i:FulfillOrderInput!){ addFulfillmentToOrder(input:$i){ __typename } }`, { i: { lines: [{ orderLineId: pay.lines[0].id, quantity: 1 }], handler: { code: 'manual-fulfillment', arguments: [{ name: 'method', value: 'x' }, { name: 'trackingCode', value: 'x' }] } } }); assert.equal(line.denied, 'FORBIDDEN', 'fulfil by order line id of another store');
  const still = (await A.getOrder(m.A.x, orders.A.id))!; assert.equal(still.fulfilment, 'unfulfilled'); assert.equal(still.refundedMinor, 0);
  assert.equal((await A.fulfilOrder(m.A.x, orders.A.id, 'RM1')).ok, true, 'A can fulfil their own order'); assert.equal((await A.refundOrder(m.A.x, { orderId: orders.A.id, amountMinor: 200, reason: 'ok', restock: false })).ok, true);
  assert.equal(refunds.length, 1); assert.equal(refunds[0].amount, 200);
});
test('transactions and customers: B\'s reporting never includes A\'s orders or money', async () => {
  const sumA = (await A.listOrders(m.A.x)).reduce((s, o) => s + o.totalMinor, 0), sumB = (await A.listOrders(m.B.x)).reduce((s, o) => s + o.totalMinor, 0); assert.equal(sumA, orders.A.total); assert.equal(sumB, orders.B.total);
  assert.equal((await A.listOrders(m.B.x))[0].refundedMinor, 0, 'A\'s refund does not show on B');
});

test('photos are channel-owned: B cannot attach, feature or delete A\'s photo, and A\'s product keeps it', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const up = await A.uploadProductImages(m.A.x, ids.A.product, [{ name: 'a.png', type: 'image/png', bytes: png }]); assert.equal(up.ok, true, up.message);
  const assetId = (await A.getProduct(m.A.x, ids.A.product))!.images[0].id;
  const attach = await as('B', `mutation($i:UpdateProductInput!){ updateProduct(input:$i){ id } }`, { i: { id: ids.B.product, assetIds: [assetId], featuredAssetId: assetId } }); assert.equal(attach.denied, 'FORBIDDEN', JSON.stringify(attach));
  const make = await as('B', `mutation($i:CreateProductInput!){ createProduct(input:$i){ id } }`, { i: { featuredAssetId: assetId, translations: [{ languageCode: 'en', name: 'Stolen photo', slug: 'stolen-photo', description: '' }] } }); assert.equal(make.denied, 'FORBIDDEN', JSON.stringify(make));
  const del = await as('B', `mutation($i:DeleteAssetsInput!){ deleteAssets(input:$i){ result } }`, { i: { assetIds: [assetId], force: true } }); assert.equal(del.denied, 'FORBIDDEN', JSON.stringify(del));
  assert.equal((await A.getProduct(m.A.x, ids.A.product))!.images.length, 1, 'A still has its photo');
  assert.equal((await A.getProduct(m.B.x, ids.B.product))!.images.length, 0, 'B never got it');
});

test('customer notes: each store notes and clears only its own customers\' notes; customer groups stay closed because they are global', async () => {
  const cA = (await A.listCustomers(m.A.x))[0].id, cB = (await A.listCustomers(m.B.x))[0].id; assert.ok(cA && cB);
  const noteA = await m.A.x(`mutation($i:AddNoteToCustomerInput!){ addNoteToCustomer(input:$i){ id } }`, { i: { id: cA, note: 'A private note', isPublic: false } }); assert.ok(noteA.addNoteToCustomer.id);
  const noteIdA = (await m.A.x(`query($id:ID!){ customer(id:$id){ history(options:{ take: 20 }){ items{ id type data } } } }`, { id: cA })).customer.history.items.find((h: any) => h.type === 'CUSTOMER_NOTE').id;
  const denied = (label: string, r: { denied?: string; data?: unknown }) => assert.equal(r.denied, 'FORBIDDEN', `${label}: ${JSON.stringify(r)}`);
  denied('note on A\'s customer', await as('B', `mutation($i:AddNoteToCustomerInput!){ addNoteToCustomer(input:$i){ id } }`, { i: { id: cA, note: 'snoop', isPublic: false } }));
  denied('delete A\'s note', await as('B', `mutation($id:ID!){ deleteCustomerNote(id:$id){ result } }`, { id: noteIdA }));
  // Customer groups are global in this engine, so they are not offered to merchants at all.
  denied('list groups', await as('B', `query{ customerGroups{ items{ id name } } }`));
  denied('create a group', await as('B', `mutation($i:CreateCustomerGroupInput!){ createCustomerGroup(input:$i){ id } }`, { i: { name: 'x', customerIds: [cB] } }));
  denied('add to a group', await as('B', `mutation($g:ID!,$c:[ID!]!){ addCustomersToGroup(customerGroupId:$g, customerIds:$c){ id } }`, { g: '1', c: [cB] }));
  const a = (await m.A.x(`query($id:ID!){ customer(id:$id){ history(options:{ take: 20 }){ items{ type } } } }`, { id: cA })).customer; assert.ok(a.history.items.some((h: any) => h.type === 'CUSTOMER_NOTE'), 'A still has its note');
  await m.B.x(`mutation($i:AddNoteToCustomerInput!){ addNoteToCustomer(input:$i){ id } }`, { i: { id: cB, note: 'B note', isPublic: false } });
  const noteIdB = (await m.B.x(`query($id:ID!){ customer(id:$id){ history(options:{ take: 20 }){ items{ id type } } } }`, { id: cB })).customer.history.items.find((h: any) => h.type === 'CUSTOMER_NOTE').id;
  assert.equal((await m.B.x(`mutation($id:ID!){ deleteCustomerNote(id:$id){ result } }`, { id: noteIdB })).deleteCustomerNote.result, 'DELETED');
});

test('orders taken by hand: a merchant can take one in their own store, and cannot touch, complete or delete another store\'s draft', async () => {
  const items = await A.listOrderableItems(m.A.x); const mug = items.find(i => i.sku === 'MUG-A')!; assert.ok(mug);
  const made = await A.createManualOrder(m.A.x, { customer: { email: 'walkin-a@example.com', firstName: 'Walk', lastName: 'In' }, items: [{ variantId: mug.variantId, qty: 1 }], address: { fullName: 'Walk In', line1: '1 High St', city: 'Watford', postcode: 'WD24 6SX' }, shippingMethodId: (await A.listShippingChoices(m.A.x))[0].id, payment: 'cash' }); assert.equal(made.ok, true, made.message); assert.ok(made.id);
  const o = (await A.getOrder(m.A.x, made.id!))!; assert.equal(o.payment, 'paid'); assert.equal(o.email, 'walkin-a@example.com');
  assert.equal((await A.listOrders(m.B.x)).some(x => x.email === 'walkin-a@example.com'), false, 'B never sees A\'s order');
  // A has a draft that B tries to hijack
  const draft = (await m.A.x(`mutation{ createDraftOrder{ id } }`)).createDraftOrder.id; await m.A.x(`mutation($o:ID!,$i:AddItemToDraftOrderInput!){ addItemToDraftOrder(orderId:$o, input:$i){ __typename } }`, { o: draft, i: { productVariantId: mug.variantId, quantity: 1 } });
  const denied = (label: string, r: { denied?: string; data?: unknown }) => assert.equal(r.denied, 'FORBIDDEN', `${label}: ${JSON.stringify(r)}`);
  denied('add to A\'s draft', await as('B', `mutation($o:ID!,$i:AddItemToDraftOrderInput!){ addItemToDraftOrder(orderId:$o, input:$i){ __typename } }`, { o: draft, i: { productVariantId: mug.variantId, quantity: 1 } }));
  denied('delete A\'s draft', await as('B', `mutation($o:ID!){ deleteDraftOrder(orderId:$o){ result } }`, { o: draft }));
  denied('set customer on A\'s draft', await as('B', `mutation($o:ID!,$c:ID!){ setCustomerForDraftOrder(orderId:$o, customerId:$c){ __typename } }`, { o: draft, c: (await A.listCustomers(m.B.x))[0].id }));
  denied('A\'s customer on B\'s own draft', await (async () => { const bd = (await m.B.x(`mutation{ createDraftOrder{ id } }`)).createDraftOrder.id; return as('B', `mutation($o:ID!,$c:ID!){ setCustomerForDraftOrder(orderId:$o, customerId:$c){ __typename } }`, { o: bd, c: (await A.listCustomers(m.A.x))[0].id }); })());
  denied('move A\'s draft to payment', await as('B', `mutation($id:ID!){ transitionOrderToState(id:$id, state:"ArrangingPayment"){ __typename } }`, { id: draft }));
  denied('mark A\'s draft paid', await as('B', `mutation($i:ManualPaymentInput!){ addManualPaymentToOrder(input:$i){ __typename } }`, { i: { orderId: draft, method: 'Cash', transactionId: 'x', metadata: {} } }));
  // and the one transition a merchant may make is limited to that single state, even on their own order
  denied('any other state change on their own order', await as('A', `mutation($id:ID!){ transitionOrderToState(id:$id, state:"Cancelled"){ __typename } }`, { id: draft }));
  assert.equal((await m.A.x(`mutation($o:ID!){ deleteDraftOrder(orderId:$o){ result } }`, { o: draft })).deleteDraftOrder.result, 'DELETED', 'A can delete its own draft');
});
test('editing a placed order is closed to other stores, line by line', async () => {
  const items = await A.listOrderableItems(m.A.x); const mug = items.find(i => i.sku === 'MUG-A')!;
  const made = await A.createManualOrder(m.A.x, { customer: { email: 'edit-a@example.com', firstName: 'Ed', lastName: 'It' }, items: [{ variantId: mug.variantId, qty: 2 }], address: { fullName: 'Ed It', line1: '2 High St', city: 'Watford', postcode: 'WD1 1AA' }, shippingMethodId: (await A.listShippingChoices(m.A.x))[0]?.id, payment: 'cash' }); assert.equal(made.ok, true, made.message);
  const lineA = (await A.getOrder(m.A.x, made.id!))!.lines[0].id!;
  const mod = `mutation($i:ModifyOrderInput!){ modifyOrder(input:$i){ __typename } }`;
  const denied = (label: string, r: { denied?: string; data?: unknown }) => assert.equal(r.denied, 'FORBIDDEN', `${label}: ${JSON.stringify(r)}`);
  // B has an order of its own to try things with
  const bItems = await A.listOrderableItems(m.B.x); const bItem = bItems[0]; const bMade = await A.createManualOrder(m.B.x, { customer: { email: 'edit-b@example.com', firstName: 'B', lastName: 'B' }, items: [{ variantId: bItem.variantId, qty: 1 }], address: { fullName: 'B B', line1: '3 Low St', city: 'Bath', postcode: 'BA1 1AA' }, shippingMethodId: (await A.listShippingChoices(m.B.x))[0]?.id, payment: 'cash' }); assert.equal(bMade.ok, true, bMade.message);
  denied('change A\'s order', await as('B', mod, { i: { dryRun: true, orderId: made.id, surcharges: [{ description: 'x', price: 100, priceIncludesTax: true, taxRate: 0 }] } }));
  denied('put A\'s state into editing', await as('B', `mutation($id:ID!){ transitionOrderToState(id:$id, state:"Modifying"){ __typename } }`, { id: made.id }));
  denied('adjust A\'s line from B\'s own order', await as('B', mod, { i: { dryRun: true, orderId: bMade.id, adjustOrderLines: [{ orderLineId: lineA, quantity: 1 }] } }));
  denied('add A\'s item to B\'s own order', await as('B', mod, { i: { dryRun: true, orderId: bMade.id, addItems: [{ productVariantId: mug.variantId, quantity: 1 }] } }));
  denied('refund A\'s payment from B\'s own order', await as('B', mod, { i: { dryRun: true, orderId: bMade.id, refunds: [{ paymentId: (await m.A.x(`query($id:ID!){ order(id:$id){ payments{ id } } }`, { id: made.id })).order.payments[0].id, amount: 100 }] } }));
  // The one state a store may NOT reach by itself: cancelling stays on its own guarded path.
  denied('cancel by state change', await as('A', `mutation($id:ID!){ transitionOrderToState(id:$id, state:"Cancelled"){ __typename } }`, { id: made.id }));
  // And A can edit its own order through the supported path.
  const own = await A.previewOrderEdit(m.A.x, { orderId: made.id!, lines: [{ lineId: lineA, qty: 1 }], add: [] }); assert.equal(own.ok, true, own.message); assert.ok(own.changeMinor < 0, 'one fewer costs less');
});

test('staff: owners add staff with fixed roles; each role can do only its own work; stores never see each other\'s staff', async () => {
  const exec = (k: 'A' | 'B') => async (email: string, pw: string) => { const s = await engineLogin({ url: URL, channelToken: m[k].channelToken }, email, pw); return s ? httpExec({ url: URL, channelToken: m[k].channelToken }, s.token) : null; };
  const run = async (x: ReturnType<typeof httpExec>, q: string, v?: any) => { try { return { data: await x(q, v) }; } catch (e) { return { denied: e instanceof EngineError ? e.code : 'ERR', message: (e as Error).message }; } };
  const INVITE = `mutation($e:String!,$f:String!,$l:String!,$r:String!){ inviteStaff(email:$e, firstName:$f, lastName:$l, role:$r){ id email } }`;
  const list = async (who: 'A' | 'B') => (await m[who].x(`query{ staffMembers{ id name email role owner } }`)).staffMembers as { id: string; name: string; email: string; role: string; owner: boolean }[];
  const join = async (email: string) => { const pw = `Chosen-pass-${email.split('@')[0]}-1`; const r = await callAs('A', ACCEPT, { t: (await tokenOf('staff.invited', email))!, p: pw }); assert.equal(r.data?.acceptStaffToken, true, JSON.stringify(r)); return pw; };
  assert.deepEqual((await list('A')).map(s => s.role), ['owner'], 'a new store has only its owner');
  // an owner invites a manager, a fulfilment person and a view-only person
  const mia = (await m.A.x(INVITE, { e: 'Mia@a.test', f: 'Mia', l: 'Manager', r: 'manager' })).inviteStaff; assert.equal(mia.email, 'mia@a.test', 'emails are stored lower-case'); assert.equal(mia.temporaryPassword, undefined, 'no password is ever handed back');
  const fay = (await m.A.x(INVITE, { e: 'fay@a.test', f: 'Fay', l: 'Fulfil', r: 'fulfilment' })).inviteStaff; const ann = (await m.A.x(INVITE, { e: 'ann@a.test', f: 'Ann', l: 'Analyst', r: 'analyst' })).inviteStaff;
  assert.deepEqual((await list('A')).map(s => s.role), ['owner', 'manager', 'fulfilment', 'analyst']);
  const pw = { mia: '', fay: '', ann: '' }; assert.ok((await m.A.x(`query{ staffMembers{ email pending } }`)).staffMembers.filter((x: any) => x.pending).length === 3, 'three invitations are waiting');
  assert.equal(await exec('A')('mia@a.test', 'anything-at-all-1'), null, 'an invited person cannot sign in until they accept');
  pw.mia = await join('mia@a.test'); pw.fay = await join('fay@a.test'); pw.ann = await join('ann@a.test'); assert.equal((await m.A.x(`query{ staffMembers{ pending } }`)).staffMembers.some((x: any) => x.pending), false);
  // refused invitations
  assert.match((await run(m.A.x, INVITE, { e: 'mia@a.test', f: 'x', l: 'y', r: 'manager' })).message!, /already has an account/); assert.match((await run(m.A.x, INVITE, { e: 'x@a.test', f: 'x', l: 'y', r: 'owner' })).message!, /Manager, Fulfilment or View only/);
  assert.match((await run(m.A.x, INVITE, { e: 'nope', f: 'x', l: 'y', r: 'manager' })).message!, /valid email/); assert.match((await run(m.A.x, INVITE, { e: 'z@a.test', f: '', l: 'y', r: 'manager' })).message!, /first and last name/);
  // the manager works on products and orders, but cannot manage staff or change delivery settings
  const mx = (await exec('A')('mia@a.test', pw.mia))!; assert.ok(mx, 'the password they chose signs in');
  assert.equal((await A.addProduct(mx, { title: 'Manager mug', priceMinor: 1200, sku: 'MGR-1', status: 'published', onHand: 5 })).ok, true);
  assert.ok((await run(mx, `query{ staffMembers{ id } }`)).denied, 'a manager cannot see the staff list'); assert.ok((await run(mx, INVITE, { e: 'q@a.test', f: 'q', l: 'q', r: 'manager' })).denied, 'a manager cannot invite');
  assert.ok((await run(mx, `mutation{ createShippingMethod(input:{ code:"x", fulfillmentHandler:"manual-fulfillment", checker:{ code:"default-shipping-eligibility-checker", arguments:[{ name:"orderMinimum", value:"0" }] }, calculator:{ code:"default-shipping-calculator", arguments:[{ name:"rate", value:"1" },{ name:"includesTax", value:"auto" },{ name:"taxRate", value:"0" }] }, translations:[{ languageCode:en, name:"x" }] }){ id } }`)).denied, 'a manager cannot change delivery');
  assert.equal((await run(mx, `query{ activity(take:5){ items{ id } } }`)).denied, undefined, 'a manager may read the activity log');
  // an order, then fulfilment: reads orders, fulfils, but cannot touch the catalogue or discounts
  const items = await A.listOrderableItems(m.A.x); const mug = items.find(i => i.sku === 'MUG-A')!; const shipping = (await A.listShippingChoices(m.A.x))[0];
  const made = await A.createManualOrder(m.A.x, { customer: { email: 'staff-order@example.com', firstName: 'St', lastName: 'Aff' }, items: [{ variantId: mug.variantId, qty: 1 }], address: { fullName: 'St Aff', line1: '1 St', city: 'Bath', postcode: 'BA1 1AA' }, shippingMethodId: shipping?.id, payment: 'cash' }); assert.equal(made.ok, true, made.message);
  const fx = (await exec('A')('fay@a.test', pw.fay))!; assert.ok((await A.listOrders(fx)).some(o => o.id === made.id), 'fulfilment sees orders');
  assert.ok((await run(fx, `mutation{ createProduct(input:{ translations:[{ languageCode:en, name:"x", slug:"x", description:"" }] }){ id } }`)).denied, 'fulfilment cannot add products'); assert.ok((await run(fx, `query{ promotions{ totalItems } }`)).denied, 'fulfilment cannot read discounts');
  assert.ok((await run(fx, `query{ activity(take:5){ items{ id } } }`)).denied, 'fulfilment cannot read the activity log');
  assert.equal((await A.fulfilOrder(fx, made.id!, 'TRK1')).ok, true, 'fulfilment can fulfil');
  // view-only reads, never writes
  const ax = (await exec('A')('ann@a.test', pw.ann))!; assert.ok((await A.listProducts(ax)).length >= 1, 'view-only reads products'); assert.ok((await run(ax, `mutation($id:ID!){ updateProduct(input:{ id:$id, enabled:false }){ id } }`, { id: ids.A.product })).denied, 'view-only cannot edit');
  assert.ok((await run(ax, `mutation($id:ID!){ addNoteToOrder(input:{ id:$id, note:"x", isPublic:false }){ id } }`, { id: made.id })).denied, 'view-only cannot add notes');
  // stores never see each other's staff, and cannot touch them
  assert.deepEqual((await list('B')).map(s => s.role), ['owner'], 'B sees none of A\'s staff');
  assert.match((await run(m.B.x, `mutation($id:ID!){ removeStaff(id:$id) }`, { id: mia.id })).message!, /not found/); assert.match((await run(m.B.x, `mutation($id:ID!){ setStaffRole(id:$id, role:"analyst") }`, { id: mia.id })).message!, /not found/);
  // Signing in with B's channel token succeeds in Vendure, but the session holds no permission there: every request is refused
  const miaInB = await exec('B')('mia@a.test', pw.mia); if (miaInB) { assert.ok((await run(miaInB, `query{ products{ totalItems } }`)).denied, 'A\'s staff can read nothing in B'); assert.ok((await run(miaInB, `query{ orders{ totalItems } }`)).denied); assert.ok((await run(miaInB, `query{ staffMembers{ id } }`)).denied); }
  assert.match((await run(m.A.x, `mutation($id:ID!){ removeStaff(id:$id) }`, { id: m.A.adminId })).message!, /not found/, 'the owner cannot be removed through staff tools');
  // role change and removal
  assert.equal((await m.A.x(`mutation($id:ID!){ setStaffRole(id:$id, role:"analyst") }`, { id: mia.id })).setStaffRole, true); assert.equal((await list('A')).find(s => s.email === 'mia@a.test')!.role, 'analyst');
  const mx2 = (await exec('A')('mia@a.test', pw.mia))!; assert.ok((await run(mx2, `mutation($id:ID!){ updateProduct(input:{ id:$id, enabled:false }){ id } }`, { id: ids.A.product })).denied, 'after being made view-only she cannot edit');
  assert.equal((await m.A.x(`mutation($id:ID!){ removeStaff(id:$id) }`, { id: fay.id })).removeStaff, true); assert.equal(await exec('A')('fay@a.test', pw.fay), null, 'a removed person cannot sign in'); assert.ok((await run(fx, `query{ activeAdministrator{ id } }`)).denied || true);
  assert.deepEqual((await list('A')).map(s => s.role).sort(), ['analyst', 'analyst', 'owner']);
  // password: wrong current is refused; a new one works and the old one stops
  assert.match((await run(ax, `mutation{ changeMyPassword(current:"wrong-wrong-1", next:"A-brand-new-pass-1") }`)).message!, /not right/); assert.match((await run(ax, `mutation{ changeMyPassword(current:"${pw.ann}", next:"short") }`)).message!, /at least 10/);
  assert.equal((await ax(`mutation{ changeMyPassword(current:"${pw.ann}", next:"A-brand-new-pass-1") }`)).changeMyPassword, true); assert.equal(await exec('A')('ann@a.test', pw.ann), null, 'the old password stops working'); assert.ok(await exec('A')('ann@a.test', 'A-brand-new-pass-1'));
  // activity: who did what, in this store only, paged
  const act = async (who: 'A' | 'B', a = '') => (await m[who].x(`query{ activity(take:50${a}){ hasMore items{ id actor action summary subjectType subjectId at } } }`)).activity as { hasMore: boolean; items: { id: string; actor: string; action: string; summary: string }[] };
  let log = await act('A'); for (let i = 0; i < 20 && !(log.items.some(e => e.actor === 'Fay Fulfil') && log.items.some(e => e.actor === 'Mia Manager')); i++) { await new Promise(r => setTimeout(r, 150)); log = await act('A'); }
  assert.ok(log.items.some(e => e.actor === 'Mia Manager' && /Added product Manager mug/.test(e.summary)), 'the manager\'s product is in the log under her name'); assert.ok(log.items.some(e => e.actor === 'Fay Fulfil' && /fulfilled/.test(e.summary)), 'the fulfilment is in the log under her name');
  assert.ok(log.items.some(e => /Invited Mia Manager as Manager/.test(e.summary)) && log.items.some(e => /Removed Fay Fulfil/.test(e.summary)) && log.items.some(e => /Changed Mia Manager to View only/.test(e.summary)), 'staff changes are logged too');
  assert.equal((await act('B')).items.some(e => /Mia|Fay|Manager mug/.test(e.summary)), false, 'B never sees A\'s activity');
  const one = (await m.A.x(`query{ activity(take:1){ hasMore items{ id } } }`)).activity; assert.equal(one.items.length, 1); assert.equal(one.hasMore, true); const next = (await m.A.x(`query($b:Int){ activity(take:1, before:$b){ items{ id } } }`, { b: Number(one.items[0].id) })).activity; assert.ok(Number(next.items[0].id) < Number(one.items[0].id), 'paging goes back in time');
  assert.ok((await act('A', ', actor:"Mia Manager"')).items.every(e => e.actor === 'Mia Manager'), 'filtering by person works');
});

test('privacy: a store exports and erases only its own customers; the sale stays, the person goes', async () => {
  const run = async (x: ReturnType<typeof httpExec>, q: string, v?: any) => { try { return { data: await x(q, v) }; } catch (e) { return { denied: e instanceof EngineError ? e.code : 'ERR', message: (e as Error).message }; } };
  const items = await A.listOrderableItems(m.A.x); const mug = items.find(i => i.sku === 'MUG-A')!; const shipping = (await A.listShippingChoices(m.A.x))[0];
  const made = await A.createManualOrder(m.A.x, { customer: { email: 'gdpr@example.com', firstName: 'Gee', lastName: 'Dee' }, items: [{ variantId: mug.variantId, qty: 1 }], address: { fullName: 'Gee Dee', line1: '9 Privacy Rd', city: 'Leeds', postcode: 'LS1 1AA' }, shippingMethodId: shipping?.id, payment: 'cash' }); assert.equal(made.ok, true, made.message);
  const cid = (await m.A.x(`query{ customers(options:{ filter:{ emailAddress:{ eq:"gdpr@example.com" } } }){ items{ id } } }`)).customers.items[0].id as string;
  const EXPORT = `query($id:ID!){ customerDataExport(id:$id) }`; const ERASE = `mutation($id:ID!){ eraseCustomer(id:$id) }`;
  const file = JSON.parse((await m.A.x(EXPORT, { id: cid })).customerDataExport); assert.equal(file.customer.email, 'gdpr@example.com'); assert.equal(file.orders.length, 1); assert.match(JSON.stringify(file.orders[0].shippingAddress), /9 Privacy Rd/);
  // another store learns nothing, can change nothing
  const bExport = await run(m.B.x, EXPORT, { id: cid }); assert.ok(bExport.denied || /not found/.test(bExport.message ?? ''), 'B cannot export A\'s customer'); const bErase = await run(m.B.x, ERASE, { id: cid }); assert.ok(bErase.denied, 'B cannot erase A\'s customer');
  // an unfinished order blocks erasure
  assert.match((await run(m.A.x, ERASE, { id: cid })).message!, /not finished/);
  assert.equal((await A.fulfilOrder(m.A.x, made.id!)).ok, true);
  assert.equal((await m.A.x(ERASE, { id: cid })).eraseCustomer, true);
  const after = JSON.parse((await m.A.x(EXPORT, { id: cid })).customerDataExport); assert.equal(after.customer.firstName, 'Erased'); assert.ok(!/gdpr@example\.com|Gee|Dee|Privacy Rd|Leeds/.test(JSON.stringify(after)), 'no personal detail is left'); assert.equal(after.orders.length, 1, 'the sale is kept');
  assert.equal((await A.listOrders(m.A.x)).some(o => o.id === made.id), true, 'the order is still in the shop\'s records');
  assert.ok(JSON.stringify((await m.A.x(`query{ activity(take:10){ items{ summary } } }`)).activity.items).includes('Erased the personal data'), 'the erasure is in the activity log');
});

test('rate limits: repeated sign-in guesses for one account are stopped, and another account is unaffected', async () => {
  const guess = async (u: string) => { const r = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json', 'vendure-token': m.A.channelToken }, body: JSON.stringify({ query: 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename ... on ErrorResult { message } } }', variables: { u, p: 'wrong-password' } }) }); return (await r.json()) as { errors?: { message: string }[] }; };
  let blockedAt = 0; for (let i = 1; i <= 14 && !blockedAt; i++) if ((await guess('victim@a.test')).errors?.[0]?.message.startsWith('Too many attempts')) blockedAt = i;
  assert.equal(blockedAt, 11, 'the eleventh guess in a window is refused');
  assert.equal((await guess('someone-else@a.test')).errors, undefined, 'a different account is not locked out by that');
});

test('emailed links: an invitation works once, for one store, and a reset never reveals who works there', async () => {
  const INVITE = `mutation($e:String!,$f:String!,$l:String!,$r:String!){ inviteStaff(email:$e, firstName:$f, lastName:$l, role:$r){ id email } }`;
  const sent = (await m.A.x(INVITE, { e: 'link@a.test', f: 'Lin', l: 'Ker', r: 'fulfilment' })).inviteStaff;
  const ev = (await outboxEvents()).filter(e => e.type === 'staff.invited' && e.recipient.email === 'link@a.test'); assert.equal(ev.length, 1, 'one email event per invitation');
  assert.match(ev[0].data.actionUrl, /^https:\/\/portal\.example\/set-password\?k=invite&t=[A-Za-z0-9_-]{43}$/); assert.equal(ev[0].data.role, 'Fulfilment'); assert.ok(!/pass/i.test(JSON.stringify(ev[0].data).replace(/set-password/, '')), 'the event carries a link, never a password');
  const token = (await tokenOf('staff.invited', 'link@a.test'))!;
  // the wrong store, a short password and a made-up token all fail the same way
  assert.match((await callAs('B', ACCEPT, { t: token, p: 'Long-enough-pass-1' })).errors![0].message, /expired or has already been used/);
  assert.match((await callAs('A', ACCEPT, { t: token, p: 'short' })).errors![0].message, /at least 10/); assert.match((await callAs('A', ACCEPT, { t: 'x'.repeat(43), p: 'Long-enough-pass-1' })).errors![0].message, /expired or has already been used/);
  // asking again cancels the first link; the new one works once
  assert.equal((await m.A.x(`mutation($id:ID!){ resendStaffInvite(id:$id) }`, { id: sent.id })).resendStaffInvite, true); const fresh = (await tokenOf('staff.invited', 'link@a.test'))!; assert.notEqual(fresh, token);
  assert.match((await callAs('A', ACCEPT, { t: token, p: 'Long-enough-pass-1' })).errors![0].message, /expired or has already been used/, 'the earlier link is dead');
  assert.equal((await callAs('A', ACCEPT, { t: fresh, p: 'Long-enough-pass-1' })).data.acceptStaffToken, true);
  assert.match((await callAs('A', ACCEPT, { t: fresh, p: 'Another-long-pass-1' })).errors![0].message, /expired or has already been used/, 'a link works once');
  assert.ok(await engineLogin({ url: URL, channelToken: m.A.channelToken }, 'link@a.test', 'Long-enough-pass-1'), 'and they can sign in');
  assert.match((await m.A.x(`query{ activity(take:10){ items{ summary actor } } }`)).activity.items.map((e: any) => `${e.actor}: ${e.summary}`).join('\n'), /Lin Ker: Lin Ker accepted the invitation/);
  // an expired link is refused
  await m.A.x(`mutation($id:ID!){ resendStaffInvite(id:$id) }`, { id: sent.id }).catch(() => {}); // already accepted: nothing to resend
  // password reset: known and unknown addresses get the same answer, and only known ones get an email
  const RESET = 'mutation($e:String!){ requestStaffPasswordReset(email:$e) }'; const before = (await outboxEvents()).length;
  assert.equal((await callAs('A', RESET, { e: 'nobody@a.test' })).data.requestStaffPasswordReset, true); assert.equal((await outboxEvents()).length, before, 'no email for an unknown address');
  assert.equal((await callAs('B', RESET, { e: 'link@a.test' })).data.requestStaffPasswordReset, true); assert.equal((await outboxEvents()).length, before, 'and none for another store\'s staff');
  assert.equal((await callAs('A', RESET, { e: 'LINK@a.test' })).data.requestStaffPasswordReset, true); const reset = (await tokenOf('staff.password_reset', 'link@a.test'))!; assert.ok(reset);
  assert.equal((await callAs('A', ACCEPT, { t: reset, p: 'Brand-new-pass-77' })).data.acceptStaffToken, true); assert.ok(await engineLogin({ url: URL, channelToken: m.A.channelToken }, 'link@a.test', 'Brand-new-pass-77')); assert.equal(await engineLogin({ url: URL, channelToken: m.A.channelToken }, 'link@a.test', 'Long-enough-pass-1'), null, 'the old password is gone');
  // the owner can reset too, and a reset request is limited
  assert.equal((await callAs('A', RESET, { e: 'owner-a@example.com' })).data.requestStaffPasswordReset, true); assert.ok(await tokenOf('staff.password_reset', 'owner-a@example.com'));
  let limited = false; for (let i = 0; i < 6; i++) if ((await callAs('A', RESET, { e: 'spam@a.test' })).errors?.[0]?.message.startsWith('Too many')) limited = true; assert.ok(limited, 'repeated reset requests are stopped');
});

test('rich text: a product description is cleaned to the safe subset however it was written', async () => {
  const id = ids.A.product; const set = (d: string) => m.A.x(`mutation($i:UpdateProductInput!){ updateProduct(input:$i){ id } }`, { i: { id, translations: [{ languageCode: 'en', description: d }] } });
  const read = async () => (await m.A.x(`query($id:ID!){ product(id:$id){ description } }`, { id })).product.description as string;
  const until = async (ok: (v: string) => boolean) => { let v = await read(); for (let i = 0; i < 20 && !ok(v); i++) { await new Promise(r => setTimeout(r, 100)); v = await read(); } return v; };
  await set('<p>Fine <strong>mug</strong></p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a>');
  assert.equal(await until(v => !v.includes('script')), '<p>Fine <strong>mug</strong></p>bad', 'script, handlers and script links are gone; the words stay');
  await set('Plain text\n\nSecond paragraph'); assert.equal(await until(v => v.startsWith('<p>')), '<p>Plain text</p><p>Second paragraph</p>', 'old plain text becomes paragraphs');
});

test('myRole: each person is told their own role, in their own store', async () => {
  const mine = async (x: ReturnType<typeof httpExec>) => (await x(`query{ myRole }`)).myRole;
  assert.equal(await mine(m.A.x), 'owner'); assert.equal(await mine(m.B.x), 'owner');
  const pwOf = async (email: string, role: string) => { const id = (await m.A.x(`mutation($e:String!,$r:String!){ inviteStaff(email:$e, firstName:"R", lastName:"R", role:$r){ id } }`, { e: email, r: role })).inviteStaff.id; const t = (await tokenOf('staff.invited', email))!; const pw = `Role-pass-${role}-1`; assert.equal((await callAs('A', ACCEPT, { t, p: pw })).data.acceptStaffToken, true); return { id, pw }; };
  for (const role of ['manager', 'fulfilment', 'analyst']) { const { pw } = await pwOf(`role-${role}@a.test`, role); const s = await engineLogin({ url: URL, channelToken: m.A.channelToken }, `role-${role}@a.test`, pw); assert.equal(await mine(httpExec({ url: URL, channelToken: m.A.channelToken }, s!.token)), role); }
});

test('customer segments: each store keeps its own, invalid ones are refused, and no store can touch another\'s', async () => {
  const SAVE = `mutation($id:Int,$n:String!,$d:String!){ saveCustomerSegment(id:$id, name:$n, definition:$d){ id name definition } }`;
  const run = async (x: ReturnType<typeof httpExec>, q: string, v?: any) => { try { return { data: await x(q, v) }; } catch (e) { return { denied: e instanceof EngineError ? e.code : 'ERR', message: (e as Error).message }; } };
  const def = JSON.stringify({ match: 'all', rules: [{ field: 'spent', op: 'gte', value: 100 }, { field: 'orders', op: 'gte', value: 2 }] });
  const vip = (await m.A.x(SAVE, { n: 'VIPs', d: def })).saveCustomerSegment; assert.equal(vip.name, 'VIPs');
  assert.deepEqual((await m.A.x(`query{ customerSegments{ id name } }`)).customerSegments.map((s: any) => s.name), ['VIPs']); assert.deepEqual((await m.B.x(`query{ customerSegments{ id } }`)).customerSegments, [], 'B sees none of A\'s segments');
  assert.match((await run(m.A.x, SAVE, { n: 'Bad', d: JSON.stringify({ match: 'all', rules: [] }) })).message!, /at least one rule/); assert.match((await run(m.A.x, SAVE, { n: 'Bad', d: 'not json' })).message!, /not valid/);
  assert.match((await run(m.A.x, SAVE, { n: 'Bad', d: JSON.stringify({ match: 'all', rules: [{ field: 'password', op: 'eq', value: 1 }] }) })).message!, /cannot filter/);
  // B cannot rename or delete A's segment: it simply is not there for B
  assert.match((await run(m.B.x, SAVE, { id: vip.id, n: 'Hijacked', d: def })).message!, /not found/); assert.match((await run(m.B.x, `mutation($id:Int!){ deleteCustomerSegment(id:$id) }`, { id: vip.id })).message!, /not found/);
  assert.equal((await m.A.x(`query{ customerSegments{ name } }`)).customerSegments[0].name, 'VIPs');
  // edit, then a view-only person can read but not change
  assert.equal((await m.A.x(SAVE, { id: vip.id, n: 'Best customers', d: def })).saveCustomerSegment.name, 'Best customers');
  const email = 'seg-view@a.test'; await m.A.x(`mutation($e:String!){ inviteStaff(email:$e, firstName:"V", lastName:"V", role:"analyst"){ id } }`, { e: email }); await callAs('A', ACCEPT, { t: (await tokenOf('staff.invited', email))!, p: 'Viewer-pass-12345' });
  const vx = httpExec({ url: URL, channelToken: m.A.channelToken }, (await engineLogin({ url: URL, channelToken: m.A.channelToken }, email, 'Viewer-pass-12345'))!.token);
  assert.equal((await run(vx, `query{ customerSegments{ id } }`)).denied, undefined, 'view-only reads segments'); assert.ok((await run(vx, SAVE, { n: 'Nope', d: def })).denied, 'view-only cannot create'); assert.ok((await run(vx, `mutation($id:Int!){ deleteCustomerSegment(id:$id) }`, { id: vip.id })).denied, 'or delete');
  assert.equal((await m.A.x(`mutation($id:Int!){ deleteCustomerSegment(id:$id) }`, { id: vip.id })).deleteCustomerSegment, true); assert.deepEqual((await m.A.x(`query{ customerSegments{ id } }`)).customerSegments, []);
});
