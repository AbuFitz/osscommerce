// A real cell for local end-to-end runs of the portal in live mode: real Vendure, the cell plugin, an in-memory Stripe, one seeded product and one paid order.
//   npx tsx proofs/dev-cell.ts   then run the portal with ENGINE_ADMIN_URL=http://localhost:3050/admin-api
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import Stripe from 'stripe';
import { CellPlugin, MemGate } from '../src/cell/plugin.ts';
import type { StripePort, PaymentIntentLite } from '../src/cell/stripe-port.ts';
const dir = path.join(__dirname, '.tmp-devcell'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
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
async function start() {
  await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, 'products.csv'), customerCount: 0 });
  await adminClient.asSuperAdmin();
  await adminClient.query(g(`mutation($i: CreatePaymentMethodInput!){ createPaymentMethod(input:$i){ id } }`), { i: { code: 'stripe-connect', enabled: true, handler: { code: 'stripe-connect', arguments: [] }, translations: [{ languageCode: 'en', name: 'Card' }] } });
}

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


(async () => { await start(); const o = await paidOrder(); await paidOrder(); console.log(`cell ready at ${URL} · sign in as owner@example.com / long-random-pass · first order ${o.id}`); process.on('SIGTERM', async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); }); })();
