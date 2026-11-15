import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import Stripe from 'stripe';
import { CellPlugin } from './plugin.ts';
import { createProductWithVariants, createCollection, previewCollection, combinations, validateDraft, ensureTaxCategories, type Exec } from './catalogue.ts';
import { parseBands, flatRateFreeOver } from './shipping.ts';

const dir = path.join(__dirname, '.tmp-cat'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const stub: any = { async createPaymentIntent() { throw new Error('x'); }, async retrievePaymentIntent() { throw new Error('x'); }, async createRefund() { throw new Error('x'); } };
const { server, adminClient, shopClient } = createTestEnvironment(mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } },
  plugins: [CellPlugin.init({ stripe: stub, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true, storeId: 'store_a', publishableKey: 'pk_test_x' }, { account: 'acct_1', seen: { markIfNew: async () => true }, orders: { byOrderCode: async () => null, setPaymentState: async () => {}, flagForReview: async () => {} }, checkout: { restrict: async () => {}, allow: async () => {} } } as any)] }));
const x: Exec = (q, v) => adminClient.query(parse(q), v as any);
before(async () => { await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/products.csv'), customerCount: 0 }); await adminClient.asSuperAdmin(); });
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });

test('draft validation: one value per option group, unique combinations and SKUs, sane numbers', () => {
  const base = { title: 'Tee', optionGroups: [{ name: 'Size', options: ['S', 'M'] }], variants: [{ options: ['S'], sku: 'T-S', priceMinor: 1000, stock: 1 }, { options: ['M'], sku: 'T-M', priceMinor: 1000, stock: 1 }] };
  assert.deepEqual(validateDraft(base), []);
  assert.ok(validateDraft({ ...base, variants: [{ options: ['S'], sku: 'A', priceMinor: 1, stock: 1 }, { options: ['S'], sku: 'A', priceMinor: 1, stock: 1 }] }).length >= 2);
  assert.match(validateDraft({ ...base, variants: [{ options: ['XL'], sku: 'A', priceMinor: 1, stock: 1 }] }).join(' '), /not a Size option/); assert.match(validateDraft({ ...base, variants: [{ options: [], sku: 'A', priceMinor: 1, stock: 1 }] }).join(' '), /choose one value/);
  assert.deepEqual(combinations([{ name: 'a', options: ['1', '2'] }, { name: 'b', options: ['x', 'y'] }]), [['1', 'x'], ['1', 'y'], ['2', 'x'], ['2', 'y']]);
});

test('a product with two option groups becomes four real engine variants with their own SKU, price, stock and tax class', async () => {
  const groups = [{ name: 'Size', options: ['S', 'M'] }, { name: 'Colour', options: ['Blue', 'Green'] }];
  const id = await createProductWithVariants(x, { title: 'Linen apron', enabled: true, optionGroups: groups, variants: combinations(groups).map((o, i) => ({ options: o, sku: `APR-${o.join('-').toUpperCase()}`, priceMinor: 3400 + i * 100, stock: 5 + i, taxClass: i === 3 ? 'zero' : 'standard', weightGrams: 150 })) });
  const p = (await x(`query($id:ID!){ product(id:$id){ enabled optionGroups{ name } variants{ sku price priceWithTax stockOnHand options{ name } taxCategory{ name } customFields{ weightGrams } } } }`, { id })).product;
  assert.equal(p.variants.length, 4); assert.deepEqual(p.optionGroups.map((g: any) => g.name).sort(), ['Colour', 'Size']);
  const v = (sku: string) => p.variants.find((q: any) => q.sku === sku); assert.equal(v('APR-S-BLUE').price, 3400); assert.equal(v('APR-M-GREEN').stockOnHand, 8); assert.deepEqual(v('APR-M-BLUE').options.map((o: any) => o.name).sort(), ['Blue', 'M']);
  assert.equal(v('APR-M-GREEN').taxCategory.name, 'Zero'); assert.equal(v('APR-M-GREEN').priceWithTax, v('APR-M-GREEN').price, 'zero-rated has no VAT'); assert.ok(v('APR-S-BLUE').priceWithTax >= v('APR-S-BLUE').price, 'standard rate applies'); assert.equal(v('APR-S-BLUE').customFields.weightGrams, 150);
});
test('tax categories are created once and reused', async () => { const a = await ensureTaxCategories(x), b = await ensureTaxCategories(x); assert.deepEqual(a, b); assert.equal(Object.keys(a).length, 3); });

test('collections: a rule previews what it matches, and the created collection holds the same variants', async () => {
  const pre = await previewCollection(x, { kind: 'name', contains: 'apron' }); assert.equal(pre.totalItems, 4);
  const empty = await previewCollection(x, { kind: 'name', contains: 'zzz-nothing' }); assert.equal(empty.totalItems, 0);
  const cid = await createCollection(x, 'Aprons', { kind: 'name', contains: 'apron' }); await new Promise(r => setTimeout(r, 1500));
  const c = (await x(`query($id:ID!){ collection(id:$id){ name productVariants{ totalItems } } }`, { id: cid })).collection; assert.equal(c.name, 'Aprons'); assert.equal(c.productVariants.totalItems, 4);
});

test('shipping calculators: free over a threshold, per item, and weight bands price an order from the engine', async () => {
  const method = async (codeName: string, calc: string, args: Record<string, string>) => (await x(`mutation($i: CreateShippingMethodInput!){ createShippingMethod(input:$i){ id } }`, { i: { code: codeName, fulfillmentHandler: 'manual-fulfillment', checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }] }, calculator: { code: calc, arguments: Object.entries(args).map(([name, value]) => ({ name, value })) }, translations: [{ languageCode: 'en', name: codeName, description: '' }] } })).createShippingMethod.id;
  const free = await method('free-over-50', 'oss-flat-rate-free-over', { rate: '495', freeOver: '5000', includesTax: 'true', taxRate: '20' });
  const item = await method('per-item', 'oss-per-item', { first: '300', additional: '100', includesTax: 'true', taxRate: '20' });
  const bands = await method('weight', 'oss-weight-bands', { bands: JSON.stringify([{ upToGrams: 200, price: 295 }, { upToGrams: 600, price: 495 }, { upToGrams: 5000, price: 895 }]), includesTax: 'true', taxRate: '20' });
  const sku = (await x(`query{ productVariants(options:{filter:{sku:{eq:"APR-S-BLUE"}}}){ items{ id } } }`)).productVariants.items[0].id;
  const price = async (qty: number) => {
    await shopClient.asAnonymousUser(); await shopClient.query(parse(`mutation($id:ID!,$q:Int!){ addItemToOrder(productVariantId:$id, quantity:$q){ __typename } }`), { id: sku, q: qty });
    await shopClient.query(parse(`mutation{ setOrderShippingAddress(input:{fullName:"A", streetLine1:"1 St", city:"X", postalCode:"AB1 2CD", countryCode:"GB"}){ __typename } }`));
    const m = (await shopClient.query(parse(`query{ eligibleShippingMethods{ id code priceWithTax } }`))).eligibleShippingMethods as { id: string; code: string; priceWithTax: number }[];
    return Object.fromEntries(m.map(q => [q.code, q.priceWithTax]));
  };
  const one = await price(1); assert.equal(one['free-over-50'], 495, 'under the threshold pays the rate'); assert.equal(one['per-item'], 300); assert.equal(one['weight'], 295, '150g is in the first band');
  const three = await price(3); assert.equal(three['free-over-50'], 0, 'a basket over £50 ships free'); assert.equal(three['per-item'], 500, 'first plus two more'); assert.equal(three['weight'], 495, '450g is in the second band');
  assert.ok(free && item && bands);
});
test('band parsing rejects malformed input', () => { assert.deepEqual(parseBands('[{"upToGrams":500,"price":5},{"upToGrams":100,"price":2}]').map(b => b.upToGrams), [100, 500]); for (const bad of ['[]', '[{"upToGrams":0,"price":1}]', '[{"upToGrams":5,"price":-1}]', 'nope']) assert.throws(() => parseBands(bad)); assert.ok(flatRateFreeOver); });
