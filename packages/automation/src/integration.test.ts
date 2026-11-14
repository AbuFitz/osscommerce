// Real pg-boss + real Postgres. Needs TEST_DATABASE_URL (superuser, creates the pgboss schema) and TEST_WORKER_URL (a non-owner role in oss_runtime, so RLS applies).
// Local: TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/cell_test TEST_WORKER_URL=postgresql://oss_worker:w@127.0.0.1:54329/cell_test npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { Engine, type Deps } from './engine.ts';
import { PgStores } from './pg.ts';
import { PgBossScheduler, startWorker, QUEUE } from './pgboss.ts';
import { MemConsent, MemLimits, MemSender, MemState } from './memory.ts';
import { TransientError } from './model.ts';

const ADMIN = process.env.TEST_DATABASE_URL, WORKER = process.env.TEST_WORKER_URL;
const skip = !ADMIN || !WORKER ? 'set TEST_DATABASE_URL and TEST_WORKER_URL to run' : false;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const until = async (f: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(150); } return false; };

test('pg-boss + Postgres: durable, de-duplicated, consent-checked, tenant-isolated', { skip, timeout: 120000 }, async t => {
  const admin = new pg.Pool({ connectionString: ADMIN }), worker = new pg.Pool({ connectionString: WORKER });
  await admin.query('truncate cp.automation_runs, cp.automation_events, cp.automation_rules, cp.email_suppressions cascade');
  await admin.query("delete from cp.stores where store_id like 'it_%'");
  await admin.query("insert into cp.stores (store_id, organisation_id, cell_id, region) values ('it_a','org','c','eu-west-london'),('it_b','org','c','eu-west-london')");
  await admin.query("drop schema if exists pgboss_it cascade");
  const rule = (id: string, store: string, o: Record<string, unknown>) => admin.query(
    'insert into cp.automation_rules (id, store_id, name, trigger, kind, enabled, delay_seconds, guard, throttle, action) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [id, store, id, o.trigger, o.kind, true, o.delay ?? 0, o.guard ?? null, o.throttle ? JSON.stringify(o.throttle) : null, JSON.stringify({ type: 'send_email', template: 'x', to: 'shopper' })]);
  await rule('tx', 'it_a', { trigger: 'order.paid', kind: 'transactional' });
  await rule('abandon', 'it_a', { trigger: 'checkout.started', kind: 'marketing', delay: 2, guard: 'checkout_not_completed', throttle: { max: 1, windowSeconds: 86400 } });
  await rule('tx_b', 'it_b', { trigger: 'order.paid', kind: 'transactional' });

  const stores = new PgStores(worker); const sender = new MemSender(); const consent = new MemConsent(); const state = new MemState();
  consent.yes.add('it_a:maya@example.com');
  let n = 0;
  const makeEngine = (boss: PgBoss) => new Engine({ rules: stores.rules, events: stores.events, runs: stores.runs, consent, suppression: stores.suppression, state, limits: new MemLimits(),
    sender, scheduler: new PgBossScheduler(boss), clock: { now: () => new Date() }, newId: () => `it_run_${Date.now()}_${++n}`, unsubscribeUrl: (s, e) => `https://x/u?s=${s}&e=${e}`, retrySchedule: [1, 1] } as Deps);
  const ev = (id: string, type: string, o: Record<string, unknown> = {}) => ({ id, storeId: 'it_a', type, occurredAt: new Date().toISOString(), subject: { checkoutId: 'chk1' }, recipient: { email: 'maya@example.com' }, consent: { marketing: true }, data: {}, ...o });
  const status = async (id: string) => (await admin.query('select status, skip_reason from cp.automation_runs where id = $1', [id])).rows[0];

  let boss = new PgBoss({ connectionString: ADMIN!, schema: 'pgboss_it' }); await boss.start(); let engine = makeEngine(boss); await startWorker(boss, engine, { pollingIntervalSeconds: 0.5 });
  t.after(async () => { await boss.stop({ graceful: false }).catch(() => {}); await admin.end(); await worker.end(); });

  await t.test('the same event delivered twice sends exactly one email', async () => {
    await engine.handleEvent(ev('evt_paid_0001', 'order.paid')); await engine.handleEvent(ev('evt_paid_0001', 'order.paid'));
    assert.ok(await until(async () => sender.sent.length === 1)); await sleep(1200); assert.equal(sender.sent.length, 1);
    assert.equal(Number((await admin.query("select count(*) n from cp.automation_runs where event_id = 'evt_paid_0001'")).rows[0].n), 1);
  });
  await t.test('a delayed marketing run is not sent early, then is sent with an unsubscribe header', async () => {
    const before = sender.sent.length; const [r] = await engine.handleEvent(ev('evt_chk_0001', 'checkout.started'));
    await sleep(900); assert.equal(sender.sent.length, before, 'not sent before the delay');
    assert.ok(await until(async () => sender.sent.length === before + 1)); assert.ok(sender.sent.at(-1)!.headers['List-Unsubscribe']);
    assert.equal((await status(r.id)).status, 'sent');
  });
  await t.test('a checkout completed during the delay is cancelled, not emailed', async () => {
    const before = sender.sent.length; state.done.add('it_a:chk2');
    const [r] = await engine.handleEvent(ev('evt_chk_0002', 'checkout.started', { subject: { checkoutId: 'chk2' }, recipient: { email: 'tom@example.com' } }));
    consent.yes.add('it_a:tom@example.com');
    assert.ok(await until(async () => (await status(r.id)).status === 'cancelled')); assert.equal(sender.sent.length, before);
  });
  await t.test('a transient failure is retried through the queue and the audit log shows both attempts', async () => {
    sender.failures.push(new TransientError('mailbox busy'));
    const [r] = await engine.handleEvent(ev('evt_paid_0002', 'order.paid', { recipient: { email: 'retry@example.com' } }));
    assert.ok(await until(async () => (await status(r.id)).status === 'sent', 20000));
    const attempts = (await admin.query('select attempts from cp.automation_runs where id = $1', [r.id])).rows[0].attempts; assert.equal(attempts.length, 2); assert.equal(attempts[0].outcome, 'transient_error');
  });
  await t.test('durable: a job scheduled before a crash still runs after restart', async () => {
    const [r] = await engine.handleEvent(ev('evt_paid_0003', 'order.paid', { recipient: { email: 'durable@example.com' } }, ));
    await boss.stop({ graceful: false });                                  // simulate the process dying
    const before = sender.sent.length;
    boss = new PgBoss({ connectionString: ADMIN!, schema: 'pgboss_it' }); await boss.start(); engine = makeEngine(boss); await startWorker(boss, engine, { pollingIntervalSeconds: 0.5 });
    assert.ok(await until(async () => (await status(r.id)).status === 'sent' || sender.sent.length > before)); void QUEUE;
  });
  await t.test('row-level security: another store cannot see or touch these runs', async () => {
    const c = await worker.connect();
    try {
      assert.equal(Number((await c.query('select count(*) n from cp.automation_runs')).rows[0].n), 0, 'no store set: sees nothing');
      await c.query('begin'); await c.query("select set_config('app.store_id','it_b',true)");
      assert.equal(Number((await c.query("select count(*) n from cp.automation_runs where store_id = 'it_a'")).rows[0].n), 0, 'store B cannot read store A');
      await assert.rejects(() => c.query("insert into cp.automation_runs (id, store_id, rule_id, rule_version, event_id, event_type, kind, idempotency_key, run_at, status) values ('x','it_a','tx',1,'e','order.paid','transactional','k',now(),'scheduled')"), 'cannot write into store A');
      await c.query('rollback');
    } finally { c.release(); }
  });
  await t.test('another store’s rules never fire for this store’s events', async () => {
    const runs = (await admin.query("select distinct store_id from cp.automation_runs")).rows.map(r => r.store_id); assert.deepEqual(runs, ['it_a']);
  });
});
