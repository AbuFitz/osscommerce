/** Boots the real Vendure engine and records what it can do, from the running schema and registries (not from memory or docs). */
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse, buildClientSchema, getIntrospectionQuery, isObjectType } from 'graphql';
import path from 'node:path'; import fs from 'node:fs';
const dir = path.join(__dirname, '.tmp-cap'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const { server, adminClient, shopClient } = createTestEnvironment(mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } } }));
const g = (s: string) => parse(s);
(async () => {
  await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, 'products.csv'), customerCount: 0 });
  await adminClient.asSuperAdmin();
  const intro = (await (adminClient as any).query(g(getIntrospectionQuery()))) as any; const schema = buildClientSchema(intro);
  const fields = (t: any) => (t && isObjectType(t) ? Object.keys(t.getFields()) : []);
  const out: any = { vendure: '3.8.2', admin: { queries: fields(schema.getQueryType()), mutations: fields(schema.getMutationType()) } };
  const reg = async (q: string, k: string) => { try { return (await adminClient.query(g(q)))[k].map((x: any) => x.code); } catch (e: any) { return `error: ${String(e.message).slice(0, 80)}`; } };
  out.registries = {
    shippingCalculators: await reg('query{ shippingCalculators{ code } }', 'shippingCalculators'), shippingEligibilityCheckers: await reg('query{ shippingEligibilityCheckers{ code } }', 'shippingEligibilityCheckers'),
    promotionConditions: await reg('query{ promotionConditions{ code } }', 'promotionConditions'), promotionActions: await reg('query{ promotionActions{ code } }', 'promotionActions'),
    collectionFilters: await reg('query{ collectionFilters{ code } }', 'collectionFilters'), paymentMethodHandlers: await reg('query{ paymentMethodHandlers{ code } }', 'paymentMethodHandlers'),
    paymentMethodEligibilityCheckers: await reg('query{ paymentMethodEligibilityCheckers{ code } }', 'paymentMethodEligibilityCheckers'), fulfillmentHandlers: await reg('query{ fulfillmentHandlers{ code } }', 'fulfillmentHandlers'),
  };
  const perm = schema.getType('Permission') as any; out.permissions = perm?.getValues?.().map((v: any) => v.name) ?? [];
  const states = schema.getType('Order') as any; out.shop = { queries: fields(schema.getQueryType()).length };
  fs.writeFileSync(path.join(__dirname, '../../../docs/engine/capability-map.json'), JSON.stringify(out, null, 1));
  console.log(`admin queries ${out.admin.queries.length}, mutations ${out.admin.mutations.length}, permissions ${out.permissions.length}`); console.log(JSON.stringify(out.registries));
  await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
