// Packs and singles on a real Vendure: selling singles until they run out opens a pack automatically, and the numbers and history agree.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig, dummyPaymentHandler, LanguageCode } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import { PackRefillPlugin, packsToOpen } from './pack-refill.ts';

test('packsToOpen: nothing while above the level, enough packs to climb back above it, never more than exist', () => {
  assert.equal(packsToOpen({ singleSaleable: 3, packSaleable: 4, unitsPerPack: 6, openAt: 2 }), 0);
  assert.equal(packsToOpen({ singleSaleable: 0, packSaleable: 4, unitsPerPack: 6, openAt: 0 }), 1);
  assert.equal(packsToOpen({ singleSaleable: -5, packSaleable: 4, unitsPerPack: 6, openAt: 0 }), 1);
  assert.equal(packsToOpen({ singleSaleable: -12, packSaleable: 4, unitsPerPack: 6, openAt: 0 }), 3);
  assert.equal(packsToOpen({ singleSaleable: -12, packSaleable: 2, unitsPerPack: 6, openAt: 0 }), 2);
  assert.equal(packsToOpen({ singleSaleable: 0, packSaleable: 0, unitsPerPack: 6, openAt: 0 }), 0);
  assert.equal(packsToOpen({ singleSaleable: 0, packSaleable: 3, unitsPerPack: 0, openAt: 0 }), 0);
});

const dir = path.join(__dirname, '.tmp-packs'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const config = mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'owner@example.com', password: 'long-random-pass' } }, paymentOptions: { paymentMethodHandlers: [dummyPaymentHandler] }, plugins: [PackRefillPlugin] });
const { server, adminClient, shopClient } = createTestEnvironment(config); const g = (s: string) => parse(s);
let single = '', pack = '';
const stock = async (id: string) => (await adminClient.query(g(`query($id:ID!){ productVariant(id:$id){ stockOnHand stockAllocated stockMovements{ items{ __typename ... on StockMovement { quantity } } } } }`), { id })).productVariant;

before(async () => {
  await server.init({ initialData: { defaultLanguage: LanguageCode.en, defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 0 }], paymentMethods: [], collections: [] }, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv') });
  await adminClient.asSuperAdmin();
  await adminClient.query(g(`mutation($i: CreatePaymentMethodInput!){ createPaymentMethod(input:$i){ id } }`), { i: { code: 'dummy', enabled: true, handler: { code: dummyPaymentHandler.code, arguments: [{ name: 'automaticSettle', value: 'true' }] }, translations: [{ languageCode: LanguageCode.en, name: 'Dummy' }] } });
  // Vendure needs distinct options to put two variants on one product, so a single and a pack are two products, each with one variant.
  const make = async (name: string, slug: string, sku: string, price: number, stock: number) => {
    const prod = (await adminClient.query(g(`mutation($i:CreateProductInput!){ createProduct(input:$i){ id } }`), { i: { translations: [{ languageCode: LanguageCode.en, name, slug, description: name }] } })).createProduct.id;
    return (await adminClient.query(g(`mutation($i:[CreateProductVariantInput!]!){ createProductVariants(input:$i){ id } }`), { i: [{ productId: prod, sku, price, trackInventory: 'TRUE', stockOnHand: stock, translations: [{ languageCode: LanguageCode.en, name }] }] })).createProductVariants[0].id as string;
  };
  single = await make('Tea bags single', 'tea-single', 'TEA-1', 300, 2); pack = await make('Tea bags box of 6', 'tea-box', 'TEA-6', 1500, 3);
  await adminClient.query(g(`mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id } }`), { i: [{ id: single, customFields: { packSourceSku: 'TEA-6', packUnits: 6, packOpenAt: 0 } }] });
});
after(async () => { await server.destroy(); });

async function buySingles(qty: number) {
  await shopClient.asAnonymousUser();
  await shopClient.query(g(`mutation($id:ID!,$q:Int!){ addItemToOrder(productVariantId:$id, quantity:$q){ __typename } }`), { id: single, q: qty });
  await shopClient.query(g(`mutation($i: CreateCustomerInput!){ setCustomerForOrder(input:$i){ __typename } }`), { i: { emailAddress: `b${qty}@example.com`, firstName: 'B', lastName: 'C' } });
  await shopClient.query(g(`mutation($i: CreateAddressInput!){ setOrderShippingAddress(input:$i){ __typename } }`), { i: { fullName: 'B C', streetLine1: '1 High St', city: 'Watford', postalCode: 'WD24 6SX', countryCode: 'GB' } });
  const m = await shopClient.query(g(`query{ eligibleShippingMethods{ id } }`));
  await shopClient.query(g(`mutation($id: [ID!]!){ setOrderShippingMethod(shippingMethodId:$id){ __typename } }`), { id: [m.eligibleShippingMethods[0].id] });
  await shopClient.query(g(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ __typename } }`));
  const r = await shopClient.query(g(`mutation{ addPaymentToOrder(input:{ method:"dummy", metadata:{} }){ __typename ... on Order { state } } }`));
  assert.equal(r.addPaymentToOrder.state, 'PaymentSettled');
}
const settle = () => new Promise(r => setTimeout(r, 1500));

test('selling the last singles opens a pack: pack count down by one, singles up by six, history recorded', async () => {
  await buySingles(2); await settle();
  const s = await stock(single), p = await stock(pack);
  assert.equal(s.stockOnHand, 2 + 6, 'two sold are still on hand until fulfilment, six released from the pack');
  assert.equal(s.stockAllocated, 2);
  assert.equal(p.stockOnHand, 2);
  assert.ok(p.stockMovements.items.some((m: any) => m.__typename === 'StockAdjustment' && m.quantity === -1), 'pack history shows the opening');
  assert.ok(s.stockMovements.items.some((m: any) => m.__typename === 'StockAdjustment' && m.quantity === 6), 'single history shows the six added');
});
test('with plenty of singles nothing is opened', async () => {
  await buySingles(1); await settle();
  assert.equal((await stock(pack)).stockOnHand, 2); assert.equal((await stock(single)).stockAllocated, 3);
});
test('no packs left: nothing is opened and nothing breaks', async () => {
  await adminClient.query(g(`mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id } }`), { i: [{ id: pack, stockOnHand: 0 }] });
  await buySingles(5); await settle();
  assert.equal((await stock(pack)).stockOnHand, 0);
});
test('a link to a variant that is not in this channel is ignored', async () => {
  await adminClient.query(g(`mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id } }`), { i: [{ id: single, stockOnHand: 60, customFields: { packSourceSku: 'NOPE-123' } }] });
  await buySingles(1); await settle(); // would throw if the plugin followed an unknown id; the order still completes
});
