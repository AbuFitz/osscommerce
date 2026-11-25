/**
 * The cell's process entry point. One cell serves one merchant: its database, channel token and Stripe account are fixed by environment at boot.
 *
 *   tsx src/main.ts                    run the API server (MODE=server), the job worker (MODE=worker) or both in one process (MODE=both, the default for a small cell)
 *   tsx src/main.ts migrate:generate N create a migration from the difference between the code and the database
 *   tsx src/main.ts migrate:run        apply pending migrations and exit
 *   tsx src/main.ts setup              first-time data: UK zone and VAT, delivery method, the Connect payment method, tax classes and the merchant's own administrator
 */
import path from 'node:path';
import Stripe from 'stripe';
import { bootstrap, bootstrapWorker, generateMigration, runMigrations, mergeConfig, JobQueueService, TransactionalConnection, PasswordCipher, RequestContextService, RequestContext, ChannelService, RoleService, AdministratorService, PaymentMethodService, Permission, LanguageCode, isGraphQlErrorResult, User, DefaultSchedulerPlugin, TaxCategoryService, type VendureConfig } from '@vendure/core';
import { TAX_CATEGORY_NAME } from '@oss-commerce/contracts';
import { populate } from '@vendure/core/cli';
import { parseEnv } from './cell/env.ts';
import { buildCellConfig } from './cell/config.ts';
import { CellPlugin, vendureWebhookDeps, type CheckoutGate } from './cell/plugin.ts';
import { liveStripe } from './cell/stripe-live.ts';
import { MERCHANT_PERMISSIONS } from './cell/merchant-role.ts';
import { syncMerchantRoles } from './cell/role-sync.ts';
import { syncSuperadmin } from './cell/superadmin-sync.ts';
import { PackRefillPlugin } from './cell/pack-refill.ts';
import { CatalogueFieldsPlugin } from './cell/catalogue-fields.ts';
import { assetPlugin, readAssetEnv, checkAssetStorage, ASSET_LIMITS } from './cell/assets.ts';
import { allLaunchChecksPass, launchChecks } from './cell/launch-readiness.ts';

const env = parseEnv(process.env);
const assets = readAssetEnv(process.env);
if (!assets && env.APP_ENV === 'production') throw new Error('Production needs object storage for media: set the ASSET_S3_* variables.');
const extra = { PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? '', CONTROL_SECRET: process.env.CONTROL_SECRET, PORT: Number(process.env.PORT ?? 3000), MODE: (process.env.MODE ?? 'both') as 'server' | 'worker' | 'both' };
const providerChecks = launchChecks({ assets, stripeSecretKey: env.STRIPE_SECRET_KEY, stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET, stripeConnectedAccountId: env.STRIPE_CONNECTED_ACCOUNT_ID, stripePublishableKey: extra.PUBLISHABLE_KEY });

// Filled in once the application is up; the webhook adapter and the checkout gate need the live database connection.
let conn!: TransactionalConnection; let ctx!: RequestContext;
const sql = (q: string, p: unknown[] = []) => conn.rawConnection.query(q, p);
/** Small durable state the cell owns outside Vendure's schema: processed webhook events (so a replay is ignored) and the checkout gate. */
const STATE_DDL = `create table if not exists oss_processed_event (account text not null, event_id text not null, seen_at timestamptz not null default now(), primary key (account, event_id));
create table if not exists oss_cell_state (key text primary key, value jsonb not null, updated_at timestamptz not null default now());`;
const gate: CheckoutGate = {
  async get() {
    const rows = await sql(`select key,value from oss_cell_state where key = 'checkout' or key like 'checkout:%'`);
    if (!rows.length) return { allowed: true };
    const blocked = rows.map((row: { value: { allowed?: boolean; reason?: string } }) => row.value).find((state: { allowed?: boolean }) => state.allowed === false);
    return blocked ? { allowed: false, reason: blocked.reason } : { allowed: true };
  },
  async set(allowed, reason, source = 'payments') {
    if (source === 'payments') await sql(`with saved as (insert into oss_cell_state (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now() returning key) delete from oss_cell_state where key='checkout'`, [`checkout:${source}`, JSON.stringify({ allowed, reason })]);
    else await sql(`insert into oss_cell_state (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()`, [`checkout:${source}`, JSON.stringify({ allowed, reason })]);
  },
};
const markIfNew = async (account: string, id: string) => (await sql(`insert into oss_processed_event (account, event_id) values ($1, $2) on conflict do nothing returning event_id`, [account, id])).length > 0;

function config(): VendureConfig {
  const sdk = new Stripe(env.STRIPE_SECRET_KEY);
  const deps = vendureWebhookDeps(env.STRIPE_CONNECTED_ACCOUNT_ID, () => conn, markIfNew, { restrict: r => gate.set(false, r), allow: () => gate.set(true) }, () => ctx);
  return mergeConfig(buildCellConfig(env), {
    dbConnectionOptions: { migrations: [path.join(__dirname, 'migrations/*.+(js|ts)')] },
    assetOptions: ASSET_LIMITS,
    // /health: the process is up (used by the host's restart check, deliberately independent of the database so a database blip does not restart the engine).
    // /ready: the process can reach its database (used by humans and monitors).
    apiOptions: { port: extra.PORT, hostname: '0.0.0.0', trustProxy: 1, csrfPrevention: true,
      middleware: [{ route: '/health', beforeListen: true, handler: (_q: unknown, r: { json: (b: unknown) => void }) => r.json({ ok: true, cell: env.CELL_ID }) },
        { route: '/ready', beforeListen: true, handler: async (_q: unknown, r: { status: (n: number) => { json: (b: unknown) => void } }) => { try { await sql('select 1'); r.status(200).json({ ready: true }); } catch { r.status(503).json({ ready: false }); } } },
        { route: '/launch-ready', beforeListen: true, handler: async (_q: unknown, r: { status: (n: number) => { json: (b: unknown) => void } }) => {
          let database = false; let checkout = false;
          try { await sql('select 1'); database = true; checkout = (await gate.get()).allowed; } catch { /* failed checks remain false */ }
          const checks = { database, checkout, ...providerChecks }; const ready = Object.values(checks).every(Boolean) && allLaunchChecksPass(providerChecks);
          r.status(ready ? 200 : 503).json({ ready, checks });
        } }] } as VendureConfig['apiOptions'],
    plugins: [...(assets ? [assetPlugin(assets)] : []), DefaultSchedulerPlugin.init(), PackRefillPlugin, CatalogueFieldsPlugin, CellPlugin.init({ stripe: liveStripe(env.STRIPE_SECRET_KEY, sdk), sdk, account: env.STRIPE_CONNECTED_ACCOUNT_ID, webhookSecret: env.STRIPE_WEBHOOK_SECRET, feeBp: env.FEE_BP, refundsReturnFee: env.REFUNDS_RETURN_FEE === 'true', storeId: env.STORE_ID, publishableKey: extra.PUBLISHABLE_KEY, checkoutGate: gate, controlSecret: extra.CONTROL_SECRET, portalUrl: env.PORTAL_URL }, deps)],
  });
}
/** Internal work (webhooks, first-time setup) runs as the platform's superadmin. Merchants never get this identity. */
async function wire(app: { get: <T>(t: any) => T }) {
  conn = app.get(TransactionalConnection); const rcs = app.get<RequestContextService>(RequestContextService);
  const user = await conn.rawConnection.getRepository(User).findOne({ where: { identifier: env.SUPERADMIN_USER }, relations: ['roles', 'roles.channels'] });
  ctx = await rcs.create({ apiType: 'admin', ...(user ? { user } : {}) }); await sql(STATE_DDL);
}

async function setup() {
  const email = process.env.MERCHANT_EMAIL, password = process.env.MERCHANT_PASSWORD, first = process.env.MERCHANT_FIRST_NAME ?? 'Store', last = process.env.MERCHANT_LAST_NAME ?? 'Owner';
  if (!email || !password || password.length < 12) throw new Error('setup needs MERCHANT_EMAIL and MERCHANT_PASSWORD (12 characters or more).');
  const probe = await bootstrap(config()); const fresh = (await probe.get(TransactionalConnection).rawConnection.query(`select count(*)::int n from zone`))[0].n === 0; await probe.close();
  const app = !fresh ? await bootstrap(config()) : await populate(() => bootstrap(config()), { defaultLanguage: LanguageCode.en, defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }, { name: 'Reduced', percentage: 5 }, { name: 'Zero', percentage: 0 }], shippingMethods: [{ name: 'Standard delivery', price: 495 }], paymentMethods: [], collections: [] } as any);
  await wire(app); const channel = await app.get(ChannelService).getDefaultChannel(ctx);
  if (!channel.pricesIncludeTax) await app.get(ChannelService).update(ctx, { id: channel.id, pricesIncludeTax: true });      // prices are entered and shown as the customer pays them
  // Tax categories are global to the engine: the platform creates them once here; merchants can only read them.
  const tc = app.get(TaxCategoryService); const cats = await tc.findAll(ctx); for (const name of Object.values(TAX_CATEGORY_NAME)) if (!cats.items.some(t => t.name === name)) await tc.create(ctx, { name });
  const pm = app.get(PaymentMethodService); if (!(await pm.findAll(ctx)).items.some(m => m.code === 'stripe-connect')) await pm.create(ctx, { code: 'stripe-connect', enabled: true, handler: { code: 'stripe-connect', arguments: [] }, translations: [{ languageCode: LanguageCode.en, name: 'Card' }] });
  const roles = app.get(RoleService); let role = (await roles.findAll(ctx)).items.find(r => r.code === 'merchant-owner');
  if (!role) role = await roles.create(ctx, { code: 'merchant-owner', description: 'Store owner', permissions: MERCHANT_PERMISSIONS, channelIds: [channel.id] });
  const admins = app.get(AdministratorService); const have = (await admins.findAll(ctx, { filter: { emailAddress: { eq: email } } })).items[0];
  if (!have) { const a = await admins.create(ctx, { emailAddress: email, firstName: first, lastName: last, password, roleIds: [role.id] }); if (isGraphQlErrorResult(a)) throw new Error('Could not create the merchant administrator.'); }
  console.log(`setup complete: channel ${channel.code}, merchant ${email}${have ? ' (already existed)' : ''}`); await app.close();
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'migrate:generate') { await generateMigration(config(), { name: process.argv[3] ?? 'change', outputDir: path.join(__dirname, 'migrations') }); process.exit(0); }
  if (cmd === 'migrate:run') { const c = config(); if (env.DATABASE_URL_DIRECT) (c.dbConnectionOptions as { url?: string }).url = env.DATABASE_URL_DIRECT; const ran = await runMigrations(c); console.log(`migrations applied: ${ran.length ? ran.join(', ') : 'none pending'}`); process.exit(0); }
  if (cmd === 'setup') { await setup(); process.exit(0); }
  if (extra.MODE === 'worker') { const w = await bootstrapWorker(config()); await wire(w.app); await w.startJobQueue(); console.log('cell worker running'); return; }
  const app = await bootstrap(config());
  try { const c = await syncSuperadmin(app.get(TransactionalConnection), app.get(PasswordCipher), env.SUPERADMIN_USER, env.SUPERADMIN_PASSWORD); const did = [c.identifier && 'username updated', c.password && 'password updated', c.retired.length && `retired ${c.retired.length} old operator account${c.retired.length > 1 ? 's' : ''} (${c.retired.join(', ')})`].filter(Boolean); if (did.length) console.log(`platform operator sign-in synced from the environment: ${did.join('; ')}`); }
  catch (e) { console.error(`PLATFORM OPERATOR SYNC FAILED, sign-in unchanged: ${e instanceof Error ? e.message : e}`); }  // loud, but never takes the shop down
  try { const ch = await syncMerchantRoles(app.get(TransactionalConnection)); if (ch.length) console.log(`merchant permissions brought up to date for: ${ch.join(', ')}`); } catch (e) { console.error(`MERCHANT ROLE SYNC FAILED: ${e instanceof Error ? e.message : e}`); }
  await wire(app);
  if (assets) void checkAssetStorage(assets).then(r => console.log(`asset storage check: ${r.ok ? 'OK' : 'FAILED'}, ${r.detail}`));
  if (extra.MODE === 'both') await app.get(JobQueueService).start();
  console.log(`cell ${env.CELL_ID} for store ${env.STORE_ID} listening on ${extra.PORT} (${extra.MODE}, ${env.APP_ENV})`);
  for (const s of ['SIGTERM', 'SIGINT'] as const) process.on(s, async () => { await app.close(); process.exit(0); });
})().catch(e => { console.error('cell failed to start:', e instanceof Error ? e.message : e); process.exit(1); });
