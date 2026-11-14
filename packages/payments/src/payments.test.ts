import { test } from 'node:test';
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
    async createAccountLink() { return { url: 'https://x' }; }, async retrieveAccount() { return acct(); }, async registerPaymentMethodDomain(a, d) { calls.push(['domain', a, d]); return { id: 'pmd_1', enabled: true, applePay: true, googlePay: true, link: true }; },
  };
  const reg: AccountRegistry = { accountFor: async s => bound.get(s) ?? null, bind: async (s, a) => { bound.set(s, a); }, audit: async e => { audit.push(e); } };
  return { d: { connect, reg }, calls, audit };
}
const owner = { userId: 'u1', storeId: 'store_a', role: 'owner' as const };
test('account creation: owner only, one account per store, idempotent on retry', async () => {
  const w = world(); await assert.rejects(ensureAccount(w.d, { ...owner, role: 'staff' }, {}), Forbidden);
  const a = await ensureAccount(w.d, owner, {}), b = await ensureAccount(w.d, owner, {}); assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(w.calls.filter(c => c[0] === 'createAccount').length, 1);
  assert.equal(w.calls[0][1].idempotencyKey, 'acct:store_a'); assert.equal(w.calls[0][1].country, 'GB');
});
test('sessions: account comes from the registry for the caller\'s store; unknown components refused; sensitive ones need owner + recent re-auth', async () => {
  const w = world(); await assert.rejects(startSession(w.d, owner, ['payments']), /not been set up/); await ensureAccount(w.d, owner, {});
  const s = await startSession(w.d, { ...owner, role: 'admin' }, ['payments', 'payouts']); assert.equal(w.calls.at(-1)[1].account, 'acct_store_a'); assert.deepEqual(s.components, ['payments', 'payouts']);
  await assert.rejects(startSession(w.d, owner, ['payments', 'transfers']), /not available/); await assert.rejects(startSession(w.d, { ...owner, role: 'staff' }, ['payments']), /do not have access/);
  await assert.rejects(startSession(w.d, { ...owner, role: 'admin' }, ['account_management']), /owner/); await assert.rejects(startSession(w.d, owner, ['account_management']), /password/);
  const now = Date.now(); assert.ok(await startSession({ ...w.d, now: () => now }, { ...owner, reauthenticatedAt: now / 1000 - 60 }, ['account_management']));
  await assert.rejects(startSession({ ...w.d, now: () => now }, { ...owner, reauthenticatedAt: now / 1000 - 3600 }, ['account_onboarding']), /password/);
  assert.ok(w.audit.some(e => e.action === 'payments.session'));
});
test('a merchant cannot obtain a session for another merchant\'s account', async () => {
  const w = world(); await ensureAccount(w.d, owner, {}); await ensureAccount(w.d, { ...owner, storeId: 'store_b' }, {});
  await startSession(w.d, { ...owner, storeId: 'store_b', role: 'admin' }, ['payments']); assert.equal(w.calls.at(-1)[1].account, 'acct_store_b');
});
test('domain registration: needs an account, only real public domains', async () => {
  const w = world(); await assert.rejects(registerCheckoutDomain(w.d, 'store_a', 'shop.example.com'), /not been set up/); await ensureAccount(w.d, owner, {});
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
