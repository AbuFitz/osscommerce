import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from './env.ts';
import { createPaymentIntentForOrder, verifyPayment, refundPayment, PaymentError } from './connect-payments.ts';
import { handleConnectEvent, advance, type WebhookDeps, type PaymentState } from './webhooks.ts';
import type { StripePort, PaymentIntentLite } from './stripe-port.ts';

const good = { APP_ENV: 'staging', STORE_ID: 'store_demo', CELL_ID: 'cell_demo', CHANNEL_TOKEN: 'x'.repeat(20), DATABASE_URL: 'postgres://u:p@h/db', REDIS_URL: 'redis://h:6379', SUPERADMIN_USER: 'ops-admin', SUPERADMIN_PASSWORD: 'long-random-pass', COOKIE_SECRET: 'c'.repeat(40), STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_WEBHOOK_SECRET: 'whsec_abc', STRIPE_CONNECTED_ACCOUNT_ID: 'acct_1', FEE_BP: '50' };

test('env: accepts a safe staging config', () => assert.equal(parseEnv(good).FEE_BP, 50));
test('env: refuses live keys outside production', () => assert.throws(() => parseEnv({ ...good, STRIPE_SECRET_KEY: 'sk_live_abc' }), /live Stripe key/));
test('env: production needs a live key', () => assert.throws(() => parseEnv({ ...good, APP_ENV: 'production' }), /live Stripe key/));
test('env: staging needs Redis so the DB can sleep', () => assert.throws(() => parseEnv({ ...good, REDIS_URL: undefined }), /REDIS_URL/));
test('env: default superadmin rejected', () => assert.throws(() => parseEnv({ ...good, SUPERADMIN_PASSWORD: 'superadmin' }), /Default superadmin/));
test('env: demo flag rejected in production', () => assert.throws(() => parseEnv({ ...good, APP_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_a', NEXT_PUBLIC_OSS_DEMO: '1' }), /Demo mode/));

function fakeStripe(over: Partial<PaymentIntentLite> = {}) {
  const calls: any[] = [];
  const s: StripePort = {
    async createPaymentIntent(a, p) { calls.push(['create', a, p]); return { id: 'pi_1', clientSecret: 'cs' }; },
    async retrievePaymentIntent() { return { id: 'pi_1', status: 'succeeded', amount: 10000, currency: 'gbp', metadata: { orderCode: 'A1' }, application_fee_amount: 50, ...over }; },
    async createRefund(a, p) { calls.push(['refund', a, p]); return { id: 're_1', status: 'succeeded' }; },
  };
  return { s, calls };
}
const order = { code: 'A1', id: '1', totalWithTaxMinor: 10000, currency: 'GBP' };

test('payments: charge on the merchant account with our fee computed server-side', async () => {
  const { s, calls } = fakeStripe();
  await createPaymentIntentForOrder({ stripe: s, account: 'acct_1', feeBp: 50, refundsReturnFee: true }, order);
  assert.equal(calls[0][1], 'acct_1'); assert.equal(calls[0][2].applicationFeeAmount, 50); assert.equal(calls[0][2].currency, 'gbp');
});
test('payments: rejects tiny totals', async () => {
  const { s } = fakeStripe();
  await assert.rejects(createPaymentIntentForOrder({ stripe: s, account: 'a', feeBp: 50, refundsReturnFee: true }, { ...order, totalWithTaxMinor: 10 }), PaymentError);
});
test('verify: settled when amount, currency, fee and order all match', async () => {
  const { s } = fakeStripe();
  assert.equal((await verifyPayment({ stripe: s, account: 'a', feeBp: 50, refundsReturnFee: true }, order, 'pi_1')).state, 'Settled');
});
test('verify: amount mismatch, wrong order and wrong fee are refused', async () => {
  const d = (o: Partial<PaymentIntentLite>) => verifyPayment({ stripe: fakeStripe(o).s, account: 'a', feeBp: 50, refundsReturnFee: true }, order, 'pi_1');
  await assert.rejects(d({ amount: 9999 }), /amount/); await assert.rejects(d({ metadata: { orderCode: 'B2' } }), /belong/); await assert.rejects(d({ application_fee_amount: 1 }), /fee/);
});
test('refund: returns our fee proportionally by default', async () => {
  const { s, calls } = fakeStripe();
  const r = await refundPayment({ stripe: s, account: 'acct_1', feeBp: 50, refundsReturnFee: true }, { paymentIntentId: 'pi_1', chargeMinor: 10000, refundMinor: 5000, refundId: 'r1' });
  assert.equal(r.feeReturnedMinor, 25); assert.equal(calls[0][2].refundApplicationFee, true); assert.equal(calls[0][2].idempotencyKey, 'refund:r1');
});
test('refund: fee kept when the agreement says so', async () => {
  const { s } = fakeStripe();
  assert.equal((await refundPayment({ stripe: s, account: 'a', feeBp: 50, refundsReturnFee: false }, { paymentIntentId: 'p', chargeMinor: 10000, refundMinor: 5000, refundId: 'r2' })).feeReturnedMinor, 0);
});

function deps(state: PaymentState = 'pending') {
  const seen = new Set<string>(); const log: string[] = []; let st = state;
  const d: WebhookDeps = {
    account: 'acct_1',
    seen: { async markIfNew(a, id) { const k = a + id; if (seen.has(k)) return false; seen.add(k); return true; } },
    orders: { async byOrderCode(c) { return c === 'A1' ? { code: 'A1', totalWithTaxMinor: 10000, currency: 'GBP', paymentState: st } : null; },
      async setPaymentState(_c, s) { st = s; log.push('state:' + s); }, async flagForReview(_c, r) { log.push('review:' + r); } },
    checkout: { async restrict(r) { log.push('restrict:' + r); }, async allow() { log.push('allow'); } },
  };
  return { d, log, get st() { return st; } };
}
const ev = (type: string, object: any, o: any = {}) => ({ id: 'evt_' + type, type, account: 'acct_1', created: 1, data: { object }, ...o });

test('webhook: other merchant account rejected', async () => assert.equal((await handleConnectEvent(ev('payment_intent.succeeded', {}, { account: 'acct_2' }), deps().d)).status, 400));
test('webhook: duplicate delivery processed once', async () => {
  const x = deps(); const e = ev('payment_intent.succeeded', { amount: 10000, currency: 'gbp', metadata: { orderCode: 'A1' } });
  await handleConnectEvent(e, x.d); const r = await handleConnectEvent(e, x.d);
  assert.equal(r.note, 'Duplicate ignored'); assert.deepEqual(x.log, ['state:paid']);
});
test('webhook: amount mismatch flagged, not paid', async () => {
  const x = deps(); await handleConnectEvent(ev('payment_intent.succeeded', { amount: 1, currency: 'gbp', metadata: { orderCode: 'A1' } }), x.d);
  assert.equal(x.st, 'pending'); assert.match(x.log[0], /^review:/);
});
test('webhook: late paid never overwrites refunded', async () => {
  const x = deps('refunded'); await handleConnectEvent(ev('payment_intent.succeeded', { amount: 10000, currency: 'gbp', metadata: { orderCode: 'A1' } }), x.d);
  assert.equal(x.st, 'refunded'); assert.equal(advance('disputed', 'paid'), 'disputed');
});
test('webhook: partial vs full refund', async () => {
  const a = deps('paid'); await handleConnectEvent(ev('charge.refunded', { amount: 10000, amount_refunded: 2500, metadata: { orderCode: 'A1' } }), a.d); assert.equal(a.st, 'partially_refunded');
  const b = deps('paid'); await handleConnectEvent(ev('charge.refunded', { amount: 10000, amount_refunded: 10000, metadata: { orderCode: 'A1' } }), b.d); assert.equal(b.st, 'refunded');
});
test('webhook: account.updated restricts and re-allows checkout', async () => {
  const x = deps(); await handleConnectEvent(ev('account.updated', { charges_enabled: false, requirements: { disabled_reason: 'requirements.past_due' } }, { id: 'e1' }), x.d);
  await handleConnectEvent(ev('account.updated', { charges_enabled: true, requirements: { disabled_reason: null } }, { id: 'e2' }), x.d);
  assert.deepEqual(x.log, ['restrict:requirements.past_due', 'allow']);
});

import { stripeWebhookMiddleware } from './webhook-route.ts';
import Stripe from 'stripe';
import http from 'node:http';
import express from 'express';

test('webhook route: bad signature 400, valid signed event 200 and applied once', async () => {
  const stripe = new Stripe('sk_test_x'); const secret = 'whsec_test'; const x = deps();
  const app = express(); app.use('/webhooks/stripe', stripeWebhookMiddleware({ stripe, secret, deps: x.d }));
  const srv = http.createServer(app); await new Promise<void>(r => srv.listen(0, r)); const port = (srv.address() as any).port;
  const body = JSON.stringify({ id: 'evt_w1', object: 'event', type: 'payment_intent.succeeded', account: 'acct_1', created: 1, data: { object: { amount: 10000, currency: 'gbp', metadata: { orderCode: 'A1' } } } });
  const post = (sig: string) => fetch(`http://127.0.0.1:${port}/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sig }, body });
  try {
    assert.equal((await post('t=1,v1=bad')).status, 400);
    const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    assert.equal((await post(sig)).status, 200); assert.equal((await post(sig)).status, 200);
    assert.deepEqual(x.log, ['state:paid']);
  } finally { srv.close(); }
});

import { MemOutbox, flush, fromOrderState, sign as cellSign } from './outbox.ts';
const ord = { id: '1', code: 'A1', totalWithTax: 7495, currencyCode: 'GBP', customer: { emailAddress: 'maya@example.com', firstName: 'Maya' } };
test('outbox: only buyer/merchant-relevant states become events; id is stable and unique per transition', () => {
  assert.equal(fromOrderState('store_a', ord, 'AddingItems', '1'), null);
  const e = fromOrderState('store_a', ord, 'PaymentSettled', '7')!; assert.equal(e.type, 'order.paid'); assert.equal(e.storeId, 'store_a'); assert.equal(e.data.totalMinor, 7495);
  assert.equal(e.id, fromOrderState('store_a', ord, 'PaymentSettled', '7')!.id); assert.notEqual(e.id, fromOrderState('store_a', ord, 'Shipped', '8')!.id);
});
test('signing format matches the control plane (shared vector)', () => assert.equal(cellSign('k'.repeat(40), '{"a":1}', 1700000000), 't=1700000000,v1=65bc88d8b5a50339be3468ec13d7cadb91095faf49ecf51063403f667356507d'));
test('dispatcher: delivered on 2xx; the same event added twice is one row; nothing re-sent after delivery', async () => {
  const s = new MemOutbox(); const e = fromOrderState('store_a', ord, 'PaymentSettled', '1')!; await s.add(e); await s.add(e); const posts: any[] = [];
  const d = { store: s, cellId: 'cell_a', secret: 's'.repeat(43), url: 'https://cp/ingest', post: async (_u: string, i: any) => { posts.push(i); return { status: 200 }; }, now: () => 1_000_000 };
  assert.deepEqual(await flush(d), { sent: 1, failed: 0 }); assert.deepEqual(await flush(d), { sent: 0, failed: 0 }); assert.equal(posts.length, 1); assert.match(posts[0].headers['oss-signature'], /^t=\d+,v1=[0-9a-f]{64}$/);
});
test('dispatcher: outage backs off exponentially, keeps the event, and succeeds when the control plane returns', async () => {
  const s = new MemOutbox(); await s.add(fromOrderState('store_a', ord, 'PaymentSettled', '1')!); let t = 1_000_000, up = false; const alerts: string[] = [];
  const d = { store: s, cellId: 'cell_a', secret: 's'.repeat(43), url: 'u', post: async () => { if (!up) throw new Error('down'); return { status: 200 }; }, now: () => t, onAlert: (m: string) => alerts.push(m), deadLetterAfter: 3 };
  await flush(d); assert.equal((await flush(d)).sent, 0, 'not due yet: backoff'); t += 31_000; await flush(d); t += 121_000; await flush(d);
  assert.ok(alerts.length >= 1, 'long outage alerts'); up = true; t += 700_000; assert.equal((await flush(d)).sent, 1);
});
test('dispatcher: a 401 raises an alert (bad credential) and keeps the events', async () => {
  const s = new MemOutbox(); await s.add(fromOrderState('store_a', ord, 'PaymentSettled', '1')!); const alerts: string[] = [];
  await flush({ store: s, cellId: 'c', secret: 's'.repeat(43), url: 'u', post: async () => ({ status: 401 }), now: () => 5, onAlert: m => alerts.push(m) }); assert.equal(alerts.length, 1); assert.equal([...s.rows.values()][0].deliveredAt, undefined);
});
