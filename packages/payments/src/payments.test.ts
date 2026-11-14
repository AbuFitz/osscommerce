import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { readiness, checkoutAllowed, ensureAccount, startSession, registerCheckoutDomain, Forbidden, Ledger, reconcile, ACCOUNT_MODEL, type StripeAccountLite, type ConnectPort, type AccountRegistry, type BalanceTxn } from './index.ts';

const acct = (o: Partial<StripeAccountLite> = {}): StripeAccountLite => ({ id: 'acct_1', charges_enabled: true, payouts_enabled: true, details_submitted: true, requirements: {}, ...o });
test('readiness: every state maps to the right status, checkout switch and call to action', () => {
  assert.equal(readiness(null).status, 'not_started');
  assert.equal(readiness(acct({ details_submitted: false, charges_enabled: false, payouts_enabled: false })).status, 'onboarding');
  const v = readiness(acct({ charges_enabled: false, payouts_enabled: false, requirements: { disabled_reason: 'requirements.pending_verification', pending_verification: ['individual.verification.document'] } })); assert.equal(v.status, 'pending_verification'); assert.equal(v.checkoutAllowed, false); assert.equal(v.actionRequired, false);
  const a = readiness(acct({ charges_enabled: false, payouts_enabled: false, requirements: { disabled_reason: 'requirements.past_due', past_due: ['external_account'] } })); assert.equal(a.status, 'action_required'); assert.deepEqual(a.due, ['external_account']); assert.equal(a.checkoutAllowed, false);
  assert.equal(readiness(acct({ charges_enabled: false, requirements: { disabled_reason: 'rejected.fraud' } })).status, 'restricted');
  const soon = readiness(acct({ requirements: { currently_due: ['company.tax_id'], current_deadline: 1_800_000_000 } })); assert.equal(soon.status, 'action_required'); assert.equal(soon.checkoutAllowed, true, 'still taking payments before the deadline'); assert.ok(soon.deadline);
  const paused = readiness(acct({ payouts_enabled: false })); assert.equal(paused.status, 'payouts_paused'); assert.equal(paused.checkoutAllowed, true);
  const ok = readiness(acct()); assert.equal(ok.status, 'enabled'); assert.equal(ok.actionRequired, false);
  const d = readiness(acct(), { disconnected: true }); assert.equal(d.status, 'disconnected'); assert.equal(d.checkoutAllowed, false);
});
test('readiness: checkout is off unless Stripe says charges are enabled', () => { assert.equal(checkoutAllowed(acct({ charges_enabled: false })), false); assert.equal(checkoutAllowed(null), false); assert.equal(checkoutAllowed(acct()), true); });

function world() {
  const calls: any[] = []; const bound = new Map<string, string>(); const audit: any[] = [];
  const connect: ConnectPort = {
    async createAccount(p) { calls.push(['createAccount', p]); return { id: `acct_${p.storeId}` }; }, async createAccountSession(p) { calls.push(['session', p]); return { clientSecret: 'cs_x', expiresAt: 1 }; },
    async createAccountLink() { return { url: 'https://x' }; }, async retrieveAccount() { return { kind: 'v1' as const, account: acct() }; }, async registerPaymentMethodDomain(a, d) { calls.push(['domain', a, d]); return { id: 'pmd_1', enabled: true, applePay: true, googlePay: true, link: true }; },
  };
  const reg: AccountRegistry = { accountFor: async s => bound.get(s) ?? null, bind: async (s, a) => { bound.set(s, a); }, audit: async e => { audit.push(e); } };
  return { d: { connect, reg }, calls, audit };
}
const owner = { userId: 'u1', storeId: 'store_a', role: 'owner' as const };
test('account creation: owner only, one account per store, idempotent on retry', async () => {
  const w = world(); await assert.rejects(ensureAccount(w.d, { ...owner, role: 'staff' }, { businessName: 'A Ltd' }), Forbidden);
  const a = await ensureAccount(w.d, owner, { businessName: 'A Ltd' }), b = await ensureAccount(w.d, owner, { businessName: 'A Ltd' }); assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(w.calls.filter(c => c[0] === 'createAccount').length, 1);
  assert.equal(w.calls[0][1].idempotencyKey, 'acct:store_a'); assert.equal(w.calls[0][1].entityType, 'company');
});
test('sessions: account comes from the registry for the caller\'s store; unknown components refused; sensitive ones need owner + recent re-auth', async () => {
  const w = world(); await assert.rejects(startSession(w.d, owner, ['payments']), /not been set up/); await ensureAccount(w.d, owner, { businessName: 'A Ltd' });
  const s = await startSession(w.d, { ...owner, role: 'admin' }, ['payments', 'payouts']); assert.equal(w.calls.at(-1)[1].account, 'acct_store_a'); assert.deepEqual(s.components, ['payments', 'payouts']);
  await assert.rejects(startSession(w.d, owner, ['payments', 'transfers']), /not available/); await assert.rejects(startSession(w.d, { ...owner, role: 'staff' }, ['payments']), /do not have access/);
  await assert.rejects(startSession(w.d, { ...owner, role: 'admin' }, ['account_management']), /owner/); await assert.rejects(startSession(w.d, owner, ['account_management']), /password/);
  const now = Date.now(); assert.ok(await startSession({ ...w.d, now: () => now }, { ...owner, reauthenticatedAt: now / 1000 - 60 }, ['account_management']));
  await assert.rejects(startSession({ ...w.d, now: () => now }, { ...owner, reauthenticatedAt: now / 1000 - 3600 }, ['account_onboarding']), /password/);
  assert.ok(w.audit.some(e => e.action === 'payments.session'));
});
test('a merchant cannot obtain a session for another merchant\'s account', async () => {
  const w = world(); await ensureAccount(w.d, owner, { businessName: 'A Ltd' }); await ensureAccount(w.d, { ...owner, storeId: 'store_b' }, { businessName: 'B Ltd' });
  await startSession(w.d, { ...owner, storeId: 'store_b', role: 'admin' }, ['payments']); assert.equal(w.calls.at(-1)[1].account, 'acct_store_b');
});
test('domain registration: needs an account, only real public domains', async () => {
  const w = world(); await assert.rejects(registerCheckoutDomain(w.d, 'store_a', 'shop.example.com'), /not been set up/); await ensureAccount(w.d, owner, { businessName: 'A Ltd' });
  assert.equal((await registerCheckoutDomain(w.d, 'store_a', 'shop.example.com')).applePay, true); assert.equal(w.calls.at(-1)[1], 'acct_store_a');
  for (const bad of ['localhost', 'a.local', 'http://x.com', 'x', 'a b.com']) await assert.rejects(registerCheckoutDomain(w.d, 'store_a', bad), Forbidden);
});
test('account model is the documented one', () => { assert.equal(ACCOUNT_MODEL.charge, 'direct'); assert.equal(ACCOUNT_MODEL.dashboard, 'full'); assert.equal(ACCOUNT_MODEL.feesPaidBy, 'account'); });

const T = (o: Partial<BalanceTxn>): BalanceTxn => ({ id: 'txn_1', type: 'charge', amount: 10000, fee: 200, fee_details: [{ type: 'stripe_fee', amount: 150 }, { type: 'application_fee', amount: 50 }], net: 9800, currency: 'GBP', created: 1_800_000_000, source: 'ch_1', metadata: { orderCode: 'A1' }, ...o });
test('ledger: splits Stripe fee from OSS application fee; imports are idempotent', () => {
  const l = new Ledger(); assert.deepEqual(l.import([T({})]), { added: 1, skipped: 0 }); assert.deepEqual(l.import([T({})]), { added: 0, skipped: 1 });
  const [e] = l.all(); assert.equal(e.processingFee, 150); assert.equal(e.applicationFee, 50); assert.equal(e.net, 9800); assert.equal(e.currency, 'gbp'); assert.equal(e.kind, 'sale');
});
test('ledger: summary nets refunds, disputes, fees; payouts are shown separately', () => {
  const l = new Ledger(); l.import([T({}), T({ id: 't2', type: 'refund', reporting_category: 'refund', amount: -5000, fee: 0, fee_details: [], net: -5000, created: 1_800_000_100 }),
    T({ id: 't3', type: 'adjustment', reporting_category: 'dispute', amount: -2000, fee: 1500, fee_details: [{ type: 'stripe_fee', amount: 1500 }], net: -3500, created: 1_800_000_200, metadata: {} }), T({ id: 't4', type: 'payout', amount: -1300, fee: 0, fee_details: [], net: -1300, created: 1_800_000_300, metadata: {} })]);
  const s = l.summary('2027-01-01', '2028-01-01'); assert.equal(s.sales, 10000); assert.equal(s.refunds, 5000); assert.equal(s.disputes, 2000); assert.equal(s.applicationFees, 50); assert.equal(s.paidOut, 1300);
});
test('reconcile: clean when the shop and Stripe agree; each kind of drift is named', () => {
  const l = new Ledger(); l.import([T({}), T({ id: 'x', metadata: { orderCode: 'B2' }, amount: 5000, fee: 100, fee_details: [{ type: 'stripe_fee', amount: 75 }, { type: 'application_fee', amount: 25 }], net: 4900 }), T({ id: 'g', metadata: { orderCode: 'GHOST' } })]);
  const orders = [{ orderCode: 'A1', paidMinor: 10000, refundedMinor: 0, currency: 'gbp' }, { orderCode: 'B2', paidMinor: 5100, refundedMinor: 0, currency: 'gbp' }, { orderCode: 'C3', paidMinor: 3000, refundedMinor: 0, currency: 'gbp' }];
  const d = reconcile(orders, l.all(), 50); const types = d.map(x => `${x.type}:${x.orderCode}`).sort();
  assert.deepEqual(types, ['amount_mismatch:B2', 'fee_mismatch:B2', 'missing_in_ledger:C3', 'missing_in_orders:GHOST']);
  assert.deepEqual(reconcile([orders[0]], new Ledger().all().length ? [] : (() => { const c = new Ledger(); c.import([T({})]); return c.all(); })(), 50), []);
});

import Stripe from 'stripe';
import { readinessFromV2, readinessOf, V2_INCLUDE, buildAccountRequest, sessionComponents, STRIPE_API_VERSION, STRIPE_SDK_VERSION, refreshReadiness, accountFromEvent, liveConnect, type V2Account, type PaymentReadiness } from './index.ts';

const cap = (status: string, codes: string[] = []) => ({ status, status_details: codes.map(code => ({ code, resolution: 'provide_info' })) });
const v2 = (o: Partial<{ card: any; payouts: any; entries: any[]; applied: boolean; merchant: any; closed: boolean }> = {}): V2Account => ({ id: 'acct_v2', closed: o.closed,
  configuration: { merchant: 'merchant' in o ? o.merchant : { applied: o.applied ?? true, capabilities: { card_payments: o.card ?? cap('active'), stripe_balance: { payouts: o.payouts ?? cap('active') } } } },
  requirements: { entries: o.entries ?? [] } });
const entry = (description: string, who: 'user' | 'stripe' = 'user', time?: string) => ({ description, awaiting_action_from: who, minimum_deadline: time ? { status: 'currently_due', time } : null, errors: [] });

test('pinned versions: the SDK default API version equals ours, so an SDK upgrade cannot silently change behaviour', () => {
  assert.equal(Stripe.API_VERSION, STRIPE_API_VERSION); assert.match(STRIPE_API_VERSION, /^\d{4}-\d{2}-\d{2}\.[a-z]+$/, 'a named release, not a preview'); assert.ok(!/preview/.test(STRIPE_API_VERSION));
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).dependencies.stripe, STRIPE_SDK_VERSION, 'exact SDK version, no range');
});
test('v2 account request is the agreed configuration, nothing else', () => {
  const r = buildAccountRequest({ storeId: 'store_a', email: 'o@shop.example', businessName: 'Shop Ltd', entityType: 'company', businessUrl: 'https://shop.example', idempotencyKey: 'k' });
  assert.equal(r.dashboard, 'full'); assert.deepEqual(r.defaults.responsibilities, { fees_collector: 'stripe', losses_collector: 'stripe' }); assert.equal(r.defaults.currency, 'gbp'); assert.equal(r.identity.country, 'gb');
  assert.deepEqual(r.configuration, { merchant: { capabilities: { card_payments: { requested: true } } } }); assert.ok(r.include.includes('requirements') && r.include.includes('configuration.merchant'));
  assert.ok(!JSON.stringify(r).includes('bank') && !JSON.stringify(r).includes('id_number'), 'we never send bank or identity numbers'); assert.equal(r.metadata.oss_store_id, 'store_a');
});
test('session components: only requested ones, refunds and disputes allowed in the payments widget, instant payouts off', () => {
  const c: any = sessionComponents(['payments', 'payouts', 'account_onboarding']); assert.deepEqual(Object.keys(c).sort(), ['account_onboarding', 'payments', 'payouts']); assert.equal(c.payments.features.refund_management, true); assert.equal(c.payouts.features.instant_payouts, false);
});
test('v2 readiness: active card + payouts is enabled; payouts pending still lets customers pay', () => {
  assert.equal(readinessFromV2(v2()).status, 'enabled'); assert.equal(readinessFromV2(v2()).checkoutAllowed, true);
  const p = readinessFromV2(v2({ payouts: cap('pending') })); assert.equal(p.status, 'enabled'); assert.equal(p.payoutsEnabled, false); assert.equal(p.checkoutAllowed, true);
  const r = readinessFromV2(v2({ payouts: cap('restricted', ['requirements_past_due']) })); assert.equal(r.status, 'payouts_paused'); assert.equal(r.checkoutAllowed, true);
});
test('v2 readiness: requirements, verification, rejection and restriction', () => {
  assert.equal(readinessFromV2(v2({ card: cap('pending'), entries: [entry('Upload ID')] })).status, 'onboarding');
  const pv = readinessFromV2(v2({ card: cap('pending', ['requirements_pending_verification']), entries: [entry('ID check', 'stripe')] })); assert.equal(pv.status, 'pending_verification'); assert.equal(pv.actionRequired, false); assert.deepEqual(pv.pending, ['ID check']);
  const a = readinessFromV2(v2({ card: cap('restricted', ['requirements_past_due']), entries: [entry('Bank account', 'user', '2027-01-01T00:00:00Z')] })); assert.equal(a.status, 'action_required'); assert.equal(a.checkoutAllowed, false); assert.ok(a.deadline);
  const soon = readinessFromV2(v2({ entries: [entry('Tax ID', 'user', '2027-03-01T00:00:00Z')] })); assert.equal(soon.status, 'action_required'); assert.equal(soon.checkoutAllowed, true);
  assert.equal(readinessFromV2(v2({ card: cap('rejected', ['rejected_fraud']) })).status, 'restricted'); assert.equal(readinessFromV2(v2({ card: cap('restricted') })).status, 'restricted');
  assert.equal(readinessFromV2(v2({ closed: true })).status, 'disconnected'); assert.equal(readinessFromV2(v2({ applied: false })).status, 'not_started');
});
test('v2 readiness: a response without the merchant configuration is UNKNOWN, never "disabled" (legacy v1 fields do not exist in v2)', () => {
  const notIncluded: V2Account = { id: 'acct_v2', configuration: null, requirements: null }; const r = readinessFromV2(notIncluded);
  assert.equal(r.status, 'unknown'); assert.notEqual(r.status, 'restricted'); assert.ok(!r.actionRequired);
  assert.equal(readinessFromV2({ id: 'x' }).status, 'unknown'); assert.ok(V2_INCLUDE.includes('configuration.merchant'));
  // a v2 object passed through the v1 mapper would read as disabled: the dispatcher must pick the mapper by kind
  assert.equal(readinessOf({ kind: 'v2', account: v2() }).status, 'enabled'); assert.equal(readinessOf({ kind: 'v1', account: acct() }).status, 'enabled');
});
test('refresh: stores fresh state; unknown never overwrites known; a slower older read never overwrites a newer one', async () => {
  let saved: { r: PaymentReadiness; at: number } | null = null; let clock = 100;
  const store = { get: async () => (saved ? { readiness: saved.r, checkedAt: saved.at } : null), save: async (_s: string, r: PaymentReadiness, at: number) => { saved = { r, at }; } };
  const d = (acc: V2Account) => ({ connect: { retrieveAccount: async () => ({ kind: 'v2' as const, account: acc }) }, store, now: () => clock });
  assert.equal((await refreshReadiness(d(v2()), 's', 'acct_v2')).stored, true); assert.equal(saved!.r.status, 'enabled');
  clock = 200; const u = await refreshReadiness(d({ id: 'acct_v2', configuration: null }), 's', 'acct_v2'); assert.equal(u.stored, false); assert.equal(saved!.r.status, 'enabled', 'unknown did not overwrite');
  clock = 50; const stale = await refreshReadiness(d(v2({ card: cap('restricted') })), 's', 'acct_v2'); assert.equal(stale.stored, false); assert.equal(saved!.r.status, 'enabled', 'older read ignored');
  clock = 300; await refreshReadiness(d(v2({ card: cap('restricted') })), 's', 'acct_v2'); assert.equal(saved!.r.status, 'restricted');
});
test('events: v1 account.updated and v2 thin events both resolve to the account to refresh; payment events do not', () => {
  assert.equal(accountFromEvent({ type: 'account.updated', account: 'acct_1' }), 'acct_1');
  for (const t of ['v2.core.account[requirements].updated', 'v2.core.account[configuration.merchant].capability_status_updated', 'v2.core.account[identity].updated']) assert.equal(accountFromEvent({ type: t, related_object: { id: 'acct_2' } }), 'acct_2');
  assert.equal(accountFromEvent({ type: 'payment_intent.succeeded', account: 'acct_1' }), null); assert.equal(accountFromEvent({ type: 'v2.core.account[requirements].updated' }), null);
});
test('live adapter: v2 create/retrieve with includes; falls back to v1 for OAuth-connected accounts; domain registration on the connected account', async () => {
  const calls: any[] = []; const stub: any = { v2: { core: { accounts: { create: async (b: any, o: any) => { calls.push(['create', b, o]); return { id: 'acct_new' }; }, retrieve: async (id: string, p: any) => { calls.push(['retrieve', id, p]); if (id === 'acct_legacy') { const e: any = new Error('v1 account'); e.code = 'v1_account_instead_of_v2_account'; throw e; } return v2(); } }, accountLinks: { create: async (b: any) => ({ url: 'https://connect.stripe.com/x', b }) } } },
    accounts: { retrieve: async () => acct() }, accountSessions: { create: async (b: any) => ({ client_secret: 'cs', expires_at: 9, b }) }, paymentMethodDomains: { create: async (b: any, o: any) => { calls.push(['pmd', b, o]); return { id: 'pmd_1', enabled: true, apple_pay: { status: 'active' }, google_pay: { status: 'active' }, link: { status: 'inactive' } }; } } };
  const c = liveConnect('sk_test_x', stub); assert.equal((await c.createAccount({ storeId: 's', businessName: 'X', entityType: 'company', idempotencyKey: 'acct:s' })).id, 'acct_new'); assert.equal(calls[0][2].idempotencyKey, 'acct:s');
  assert.equal((await c.retrieveAccount('acct_new')).kind, 'v2'); assert.deepEqual(calls[1][2].include, [...V2_INCLUDE]); assert.equal((await c.retrieveAccount('acct_legacy')).kind, 'v1');
  const d = await c.registerPaymentMethodDomain('acct_new', 'shop.example.com'); assert.equal(d.applePay, true); assert.equal(d.link, false); assert.deepEqual(calls.at(-1)[2], { stripeAccount: 'acct_new' });
});
