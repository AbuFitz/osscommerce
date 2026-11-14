/**
 * Empirical tenant-isolation probe for Vendure 3.8.2 channels.
 * Two unrelated merchants (channels), identical shopper email and SKU.
 * Prints PASS/LEAK per probe; exits non-zero only on harness failure so the
 * results can be recorded in docs/adr/0001-engine-selection.md.
 */
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '.tmp');
fs.mkdirSync(dataDir, { recursive: true });
registerInitializer('sqljs', new SqljsInitializer(dataDir));

const results: { probe: string; verdict: 'PASS' | 'LEAK'; detail: string }[] = [];
const record = (probe: string, ok: boolean, detail: string) => {
  results.push({ probe, verdict: ok ? 'PASS' : 'LEAK', detail });
  console.log(`${ok ? 'PASS' : 'LEAK'}  ${probe} — ${detail}`);
};

const config = mergeConfig(testConfig, {
  authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'superadmin', password: 'superadmin' } },
});
const { server, adminClient, shopClient } = createTestEnvironment(config);

import { parse } from 'graphql';
const gql = (s: string) => parse(s);
const initialData: any = {
  defaultLanguage: 'en', defaultZone: 'UK',
  countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }],
  taxRates: [{ name: 'Standard', percentage: 20 }],
  shippingMethods: [{ name: 'Standard', price: 500 }],
  paymentMethods: [], collections: [],
};

async function createMerchant(code: string, token: string) {
  const seller = await adminClient.query(gql(`mutation($i: CreateSellerInput!){ createSeller(input:$i){ id } }`), { i: { name: `Seller ${code}` } });
  const channel = await adminClient.query(gql(`mutation($i: CreateChannelInput!){ createChannel(input:$i){ ... on Channel { id token } ... on LanguageNotAvailableError { message } } }`), {
    i: { code, token, sellerId: seller.createSeller.id, defaultLanguageCode: 'en', pricesIncludeTax: true, currencyCode: 'GBP', defaultTaxZoneId: 1, defaultShippingZoneId: 1 },
  });
  const role = await adminClient.query(gql(`mutation($i: CreateRoleInput!){ createRole(input:$i){ id } }`), {
    i: { code: `${code}-owner`, description: code, channelIds: [channel.createChannel.id],
      permissions: ['ReadCatalog','UpdateCatalog','CreateCatalog','ReadCustomer','UpdateCustomer','CreateCustomer','ReadOrder','ReadSettings'] },
  });
  await adminClient.query(gql(`mutation($i: CreateAdministratorInput!){ createAdministrator(input:$i){ id } }`), {
    i: { firstName: code, lastName: 'Owner', emailAddress: `${code}@merchant.test`, password: 'merchant-pass-1', roleIds: [role.createRole.id] },
  });
  return { id: channel.createChannel.id, token };
}

(async () => {
  await server.init({ initialData, productsCsvPath: path.join(__dirname, 'empty.csv'), customerCount: 0 });
  await adminClient.asSuperAdmin();
  const A = await createMerchant('merchant-a', 'token-a');
  const B = await createMerchant('merchant-b', 'token-b');

  // Same shopper email registers at both stores with DIFFERENT passwords.
  const reg = `mutation($i: RegisterCustomerInput!){ registerCustomerAccount(input:$i){ __typename ... on Success { success } ... on ErrorResult { message } } }`;
  shopClient.setChannelToken(A.token);
  const rA = await shopClient.query(gql(reg), { i: { emailAddress: 'shopper@example.com', password: 'password-for-A-1' } });
  shopClient.setChannelToken(B.token);
  const rB = await shopClient.query(gql(reg), { i: { emailAddress: 'shopper@example.com', password: 'password-for-B-1' } });
  record('P1 same email registers at both stores', rA.registerCustomerAccount.__typename === 'Success' && rB.registerCustomerAccount.__typename === 'Success',
    `A=${rA.registerCustomerAccount.__typename} B=${rB.registerCustomerAccount.__typename} (if B is an error, email is globally unique across tenants)`);

  // Credential bleed: A's password must NOT authenticate against store B.
  const login = `mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename ... on CurrentUser { id identifier } ... on ErrorResult { message } } }`;
  shopClient.setChannelToken(B.token);
  await shopClient.asAnonymousUser();
  const bWithA = await shopClient.query(gql(login), { u: 'shopper@example.com', p: 'password-for-A-1' });
  record('P2 store-A password logs into store B', bWithA.login.__typename !== 'CurrentUser',
    `login result at B using A's password: ${bWithA.login.__typename}`);

  // Customer record sharing across channels via admin.
  const custQ = `query{ customers{ items{ id emailAddress } totalItems } }`;
  await adminClient.asUserWithCredentials('merchant-a@merchant.test', 'merchant-pass-1');
  adminClient.setChannelToken(A.token);
  const ca = await adminClient.query(gql(custQ));
  await adminClient.asUserWithCredentials('merchant-b@merchant.test', 'merchant-pass-1');
  adminClient.setChannelToken(B.token);
  const cb = await adminClient.query(gql(custQ));
  const idsA = ca.customers.items.map((c: any) => c.id), idsB = cb.customers.items.map((c: any) => c.id);
  record('P3 customers are distinct records per store', idsA.length > 0 && idsB.length > 0 && !idsA.some((i: any) => idsB.includes(i)),
    `A sees customer ids [${idsA}], B sees [${idsB}] (identical ids = one shared Customer row)`);

  // Merchant A admin forging the channel token of B.
  adminClient.setChannelToken(A.token);
  await adminClient.asUserWithCredentials('merchant-a@merchant.test', 'merchant-pass-1');
  adminClient.setChannelToken(B.token);
  let forged = 'denied';
  try { const r = await adminClient.query(gql(`query{ customers{ totalItems } }`)); forged = `allowed(${r.customers.totalItems})`; } catch (e: any) { forged = 'denied: ' + String(e.message).slice(0, 60); }
  record('P4 merchant-A admin with forged B channel header', forged.startsWith('denied'), forged);

  // Global (unscoped) settings visible to channel-scoped merchants.
  adminClient.setChannelToken(A.token);
  let zones = 'denied';
  try { const r = await adminClient.query(gql(`query{ zones{ totalItems } countries{ totalItems } taxRates{ totalItems } }`)); zones = `visible zones=${r.zones.totalItems} countries=${r.countries.totalItems} taxRates=${r.taxRates.totalItems}`; } catch (e: any) { zones = 'denied'; }
  record('P5 global zones/tax visible to merchant admin (must be OSS-only)', zones === 'denied', zones);

  // Role listing leak: merchant A sees other tenants' roles/administrators?
  let roles = 'denied';
  try { const r = await adminClient.query(gql(`query{ roles{ items{ code } } }`)); roles = r.roles.items.map((x: any) => x.code).join(','); } catch { roles = 'denied'; }
  record('P6 merchant-A can enumerate roles of B', !roles.includes('merchant-b'), `roles seen: ${roles}`);

  fs.writeFileSync(path.join(__dirname, 'isolation.results.json'), JSON.stringify({ vendure: '3.8.2', at: new Date().toISOString(), results }, null, 2));
  await server.destroy();
})().catch(async e => { console.error('HARNESS FAILURE', e); try { await server.destroy(); } catch {} process.exit(2); });
