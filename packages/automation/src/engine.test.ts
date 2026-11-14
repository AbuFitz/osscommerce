import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, type Deps } from './engine.ts';
import { FakeClock, MemConsent, MemEvents, MemLimits, MemRules, MemRuns, MemScheduler, MemSender, MemState, MemSuppression } from './memory.ts';
import { PermanentError, TransientError, type Rule } from './model.ts';
import { deferOutOfQuietHours, idempotencyKey, nextRetryDelaySeconds, MAX_ATTEMPTS } from './policy.ts';

const S = 'store_1';
const base = (o: Partial<Rule>): Rule => ({ id: 'r', storeId: S, name: 'r', version: 1, trigger: 'order.paid', kind: 'transactional', enabled: true, delaySeconds: 0, conditions: [], action: { type: 'send_email', template: 'order_confirmation', to: 'shopper' }, ...o });
const ev = (o: Record<string, unknown> = {}) => ({ id: 'evt_00000001', storeId: S, type: 'order.paid', occurredAt: '2026-11-14T12:00:00Z', subject: { orderId: 'o1', checkoutId: 'c1' }, recipient: { email: 'maya@example.com' }, consent: { marketing: false }, data: { totalMinor: 7495, merchantEmail: 'owner@shop.example' }, ...o });
function setup(rules: Rule[]) {
  const m = { rules: new MemRules(rules), events: new MemEvents(), runs: new MemRuns(), consent: new MemConsent(), suppression: new MemSuppression(), state: new MemState(), limits: new MemLimits(), sender: new MemSender(), scheduler: new MemScheduler(), clock: new FakeClock() };
  let n = 0; const deps: Deps = { ...m, newId: () => `run_${++n}`, unsubscribeUrl: (s, e) => `https://shop.example/unsubscribe?s=${s}&e=${encodeURIComponent(e)}` };
  return { ...m, engine: new Engine(deps) };
}
const runAll = async (t: ReturnType<typeof setup>) => { for (const id of [...t.runs.m.keys()]) await t.engine.executeRun(S, id); };

test('an event creates one run and one email; redelivery of the same event cannot send twice', async () => {
  const t = setup([base({})]);
  assert.equal((await t.engine.handleEvent(ev())).length, 1);
  assert.equal((await t.engine.handleEvent(ev())).length, 0, 'duplicate delivery creates no run');
  await runAll(t); await runAll(t);
  assert.equal(t.sender.sent.length, 1);
});
test('executing a finished run again does nothing', async () => { const t = setup([base({})]); const [r] = await t.engine.handleEvent(ev()); await t.engine.executeRun(S, r.id); await t.engine.executeRun(S, r.id); assert.equal(t.sender.sent.length, 1); });
test('conditions filter events', async () => {
  const t = setup([base({ conditions: [{ path: 'data.totalMinor', op: 'gte', value: 10000 }] })]);
  assert.equal((await t.engine.handleEvent(ev())).length, 0);
  assert.equal((await t.engine.handleEvent(ev({ id: 'evt_00000002', data: { totalMinor: 20000 } }))).length, 1);
});
test('transactional rules cannot be switched off; operational rules can', async () => {
  const t = setup([base({ id: 'a', enabled: false }), base({ id: 'b', kind: 'operational', enabled: false, action: { type: 'send_email', template: 'merchant_new_order', to: 'merchant' } })]);
  const runs = await t.engine.handleEvent(ev()); assert.deepEqual(runs.map(r => r.ruleId), ['a']);
});
test('operational email goes to the merchant address, not the shopper', async () => {
  const t = setup([base({ kind: 'operational', action: { type: 'send_email', template: 'merchant_new_order', to: 'merchant' } })]);
  await t.engine.handleEvent(ev()); await runAll(t); assert.equal(t.sender.sent[0].to, 'owner@shop.example');
});
test('marketing needs live consent; the event snapshot alone is not enough', async () => {
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started' })]);
  await t.engine.handleEvent(ev({ type: 'checkout.started', consent: { marketing: true } }));   // snapshot says yes
  await runAll(t); assert.equal(t.sender.sent.length, 0, 'ledger has no consent, so nothing sent');
  const run = [...t.runs.m.values()][0]; assert.equal(run.status, 'skipped'); assert.equal(run.skipReason, 'no_consent');
});
test('marketing with consent is sent with unsubscribe headers; transactional carries none', async () => {
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started' }), base({ id: 'tx' })]);
  t.consent.yes.add(`${S}:maya@example.com`);
  await t.engine.handleEvent(ev({ type: 'checkout.started' })); await t.engine.handleEvent(ev({ id: 'evt_00000009' })); await runAll(t);
  const mk = t.sender.sent.find(s => s.headers['List-Unsubscribe']); assert.ok(mk, 'marketing has List-Unsubscribe'); assert.equal(mk!.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(t.sender.sent.some(s => !s.headers['List-Unsubscribe']), 'transactional has none');
});
test('consent withdrawn between event and send stops the email', async () => {
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started', delaySeconds: 7200 })]); t.consent.yes.add(`${S}:maya@example.com`);
  await t.engine.handleEvent(ev({ type: 'checkout.started' })); t.consent.yes.clear(); await runAll(t); assert.equal(t.sender.sent.length, 0);
});
test('abandoned checkout: scheduled 2 hours out, cancelled if the checkout completes first', async () => {
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started', delaySeconds: 7200, guard: 'checkout_not_completed' })]); t.consent.yes.add(`${S}:maya@example.com`);
  const [r] = await t.engine.handleEvent(ev({ type: 'checkout.started' }));
  assert.equal(new Date(r.runAt).getTime() - t.clock.now().getTime(), 7200_000);
  t.state.done.add(`${S}:c1`); await t.engine.executeRun(S, r.id);
  assert.equal(t.sender.sent.length, 0); assert.equal((await t.runs.get(S, r.id))!.status, 'cancelled');
});
test('suppressed addresses (bounce, complaint, unsubscribe) never receive email', async () => {
  const t = setup([base({})]); t.suppression.set.add(`${S}:maya@example.com`); await t.engine.handleEvent(ev()); await runAll(t);
  assert.equal(t.sender.sent.length, 0); assert.equal([...t.runs.m.values()][0].skipReason, 'suppressed');
});
test('throttle: a recipient gets at most one marketing email per window', async () => {
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started', throttle: { max: 1, windowSeconds: 86400 } })]); t.consent.yes.add(`${S}:maya@example.com`);
  await t.engine.handleEvent(ev({ id: 'evt_00000010', type: 'checkout.started' })); await runAll(t);
  await t.engine.handleEvent(ev({ id: 'evt_00000011', type: 'checkout.started' })); await runAll(t);
  assert.equal(t.sender.sent.length, 1); assert.ok([...t.runs.m.values()].some(r => r.skipReason === 'throttled'));
});
test('transient failures retry with backoff and are logged; success ends the run', async () => {
  const t = setup([base({})]); t.sender.failures.push(new TransientError('mailbox busy'));
  const [r] = await t.engine.handleEvent(ev()); await t.engine.executeRun(S, r.id);
  let run = (await t.runs.get(S, r.id))!; assert.equal(run.status, 'failed_retrying'); assert.match(run.attempts[0].detail, /Retrying in 60s/);
  const retry = t.scheduler.jobs.at(-1)!; assert.equal(retry.attempt, 2); assert.equal(retry.at.getTime() - t.clock.now().getTime(), 60_000);
  await t.engine.executeRun(S, r.id); run = (await t.runs.get(S, r.id))!; assert.equal(run.status, 'sent'); assert.equal(run.attempts.length, 2);
});
test('gives up after the last attempt; permanent errors do not retry at all', async () => {
  const t = setup([base({})]); const [r] = await t.engine.handleEvent(ev());
  for (let i = 0; i < MAX_ATTEMPTS; i++) { t.sender.failures.push(new TransientError('down')); await t.engine.executeRun(S, r.id); }
  assert.equal((await t.runs.get(S, r.id))!.status, 'failed'); assert.equal((await t.runs.get(S, r.id))!.attempts.length, MAX_ATTEMPTS);
  const t2 = setup([base({})]); t2.sender.failures.push(new PermanentError('invalid address')); const [r2] = await t2.engine.handleEvent(ev()); await t2.engine.executeRun(S, r2.id);
  assert.equal((await t2.runs.get(S, r2.id))!.status, 'failed'); assert.equal(t2.scheduler.jobs.length, 1, 'no retry scheduled');
});
test('turning a rule off after scheduling cancels the run (kill switch)', async () => {
  const rule = base({ kind: 'operational', delaySeconds: 3600, action: { type: 'send_email', template: 'merchant_new_order', to: 'merchant' } }); const t = setup([rule]);
  const [r] = await t.engine.handleEvent(ev()); rule.enabled = false; await t.engine.executeRun(S, r.id);
  assert.equal(t.sender.sent.length, 0); assert.equal((await t.runs.get(S, r.id))!.status, 'cancelled');
});
test('monthly allowance limits optional automations but never transactional email', async () => {
  const t = setup([base({ id: 'tx' }), base({ id: 'op', kind: 'operational', action: { type: 'send_email', template: 'x', to: 'merchant' } })]);
  t.limits.limit = 0; await t.engine.handleEvent(ev()); await runAll(t);
  assert.equal(t.sender.sent.filter(s => s.audience === 'shopper').length, 1, 'transactional still sent');
  assert.ok([...t.runs.m.values()].some(r => r.skipReason === 'limit_reached'));
});
test('quiet hours push marketing out of the night, in the merchant time zone', async () => {
  const q = { tz: 'Europe/London', from: 21, to: 8 };
  assert.equal(deferOutOfQuietHours(new Date('2026-11-14T23:30:00Z'), q).toISOString(), '2026-11-15T08:00:00.000Z');
  assert.equal(deferOutOfQuietHours(new Date('2026-11-14T14:00:00Z'), q).toISOString(), '2026-11-14T14:00:00.000Z');
  assert.equal(deferOutOfQuietHours(new Date('2026-07-01T20:30:00Z'), q).toISOString(), '2026-07-02T07:00:00.000Z', 'British Summer Time: 21:30 local is quiet until 08:00 local');
  const t = setup([base({ kind: 'marketing', trigger: 'checkout.started' })]); t.limits.quiet = q; t.clock.t = new Date('2026-11-14T23:30:00Z');
  const [r] = await t.engine.handleEvent(ev({ type: 'checkout.started' })); assert.equal(r.runAt, '2026-11-15T08:00:00.000Z');
});
test('policy: backoff schedule and stable, case-insensitive idempotency keys', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => nextRetryDelaySeconds(n)), [60, 300, 1800, 7200, 21600, null]);
  assert.equal(idempotencyKey('s', 'r', 'e', 'A@B.com'), idempotencyKey('s', 'r', 'e', 'a@b.com'));
  assert.notEqual(idempotencyKey('s', 'r', 'e', 'a@b.com'), idempotencyKey('s', 'r', 'e2', 'a@b.com'));
});
test('tenant isolation: a rule from another store never fires', async () => {
  const t = setup([base({ storeId: 'other' })]); assert.equal((await t.engine.handleEvent(ev())).length, 0);
});
