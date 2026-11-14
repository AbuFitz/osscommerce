import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import Stripe from 'stripe';
import { CellPlugin } from './plugin.ts';
import type { StripePort } from './stripe-port.ts';

const dir = path.join(__dirname, '.tmp-boot'); fs.mkdirSync(dir, { recursive: true });
registerInitializer('sqljs', new SqljsInitializer(dir));
const stripe: StripePort = { async createPaymentIntent() { throw new Error('unused'); }, async retrievePaymentIntent() { throw new Error('unused'); }, async createRefund() { throw new Error('unused'); } };
const deps: any = { account: 'acct_1', seen: { markIfNew: async () => true }, orders: { byOrderCode: async () => null, setPaymentState: async () => {}, flagForReview: async () => {} }, checkout: { restrict: async () => {}, allow: async () => {} } };
const config = mergeConfig(testConfig, {
  authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } },
  plugins: [CellPlugin.init({ stripe, sdk: new Stripe('sk_test_x'), account: 'acct_1', webhookSecret: 'whsec_x', feeBp: 50, refundsReturnFee: true }, deps)],
});
const { server, adminClient } = createTestEnvironment(config);
const initialData: any = { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] };
before(async () => { await server.init({ initialData, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv'), customerCount: 0 }); });
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });

test('boot: the Connect handler is registered with Vendure', async () => {
  await adminClient.asSuperAdmin();
  const r = await adminClient.query(parse(`query{ paymentMethodHandlers{ code } }`));
  assert.ok(r.paymentMethodHandlers.some((h: any) => h.code === 'stripe-connect'));
});
test('boot: webhook route is live and rejects an unsigned call', async () => {
  const res = await fetch(`http://localhost:${testConfig.apiOptions.port}/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 400);
});
