import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow, messageFor, appearance, checkoutApi, type State, type Api, type StripeResult } from './index.ts';

const session = { clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1', publishableKey: 'pk_test_x', stripeAccount: 'acct_1', amount: 7495, currency: 'gbp', orderCode: 'A1' };
function mk(o: { confirm?: () => Promise<StripeResult>; complete?: Api['completeOrder']; create?: Api['createSession'] } = {}) {
  const states: State[] = []; const calls = { confirm: 0, complete: 0, create: 0 };
  const api: Api = { createSession: async () => { calls.create++; return (o.create ?? (async () => session))(); }, completeOrder: async (...a) => { calls.complete++; return (o.complete ?? (async () => ({ ok: true as const, code: 'A1', state: 'PaymentSettled' })))(...a); }, orderState: async () => null };
  const flow = createFlow({ api, onState: s => states.push(s), sleep: async () => {}, pollMs: 0, maxPolls: 3, confirm: async () => { calls.confirm++; return (o.confirm ?? (async () => ({ paymentIntent: { id: 'pi_1', status: 'succeeded' } })))(); } });
  return { flow, states, calls };
}

test('happy path: prepare, pay, server verifies, order complete', async () => {
  const t = mk(); await t.flow.prepare(); assert.equal(t.flow.state.phase, 'ready'); const s = await t.flow.pay();
  assert.equal(s.phase, 'complete'); assert.equal(s.orderCode, 'A1'); assert.deepEqual(t.states.map(x => x.phase), ['preparing', 'ready', 'confirming', 'verifying', 'complete']);
});
test('double click or double tap cannot pay twice: the second submit shares the first', async () => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); const t = mk({ confirm: async () => { await gate; return { paymentIntent: { id: 'pi_1', status: 'succeeded' } }; } });
  await t.flow.prepare(); const a = t.flow.pay(), b = t.flow.pay(), c = t.flow.pay(); release(); await Promise.all([a, b, c]);
  assert.equal(t.calls.confirm, 1); assert.equal(t.calls.complete, 1); assert.equal(t.flow.state.phase, 'complete');
});
test('a payment cannot be started before the session is ready, or after it completed', async () => {
  const t = mk(); assert.equal((await t.flow.pay()).phase, 'idle'); assert.equal(t.calls.confirm, 0);
  await t.flow.prepare(); await t.flow.pay(); await t.flow.pay(); assert.equal(t.calls.confirm, 1);
});
test('declines and authentication failures show a clear message, allow a retry, and never reach the server', async () => {
  let n = 0; const t = mk({ confirm: async () => (++n === 1 ? { error: { code: 'card_declined' } } : { paymentIntent: { id: 'pi_1', status: 'succeeded' } }) });
  await t.flow.prepare(); const first = await t.flow.pay(); assert.equal(first.phase, 'failed'); assert.match(first.error!, /declined/); assert.equal(t.calls.complete, 0);
  const second = await t.flow.pay(); assert.equal(second.phase, 'complete'); assert.equal(second.attempts, 2);
});
test('"succeeded" from the browser is not enough: if the server refuses it, the order is not placed and the shopper is told what to do', async () => {
  const t = mk({ complete: async () => ({ ok: false as const, message: 'Payment amount does not match the order total.' }) });
  await t.flow.prepare(); const s = await t.flow.pay(); assert.equal(s.phase, 'failed'); assert.match(s.error!, /contact the shop/); assert.ok(!/amount/.test(s.error!), 'provider detail is not shown');
});
test('asynchronous methods: processing is polled, then completes; a long delay says do not pay twice', async () => {
  let k = 0; const ok = mk({ confirm: async () => ({ paymentIntent: { id: 'pi_1', status: 'processing' } }), complete: async () => (++k < 3 ? { ok: false as const, message: 'pending' } : { ok: true as const, code: 'A1', state: 'PaymentSettled' }) });
  await ok.flow.prepare(); assert.equal((await ok.flow.pay()).phase, 'complete'); assert.equal(ok.calls.complete, 3);
  const slow = mk({ confirm: async () => ({ paymentIntent: { id: 'pi_1', status: 'processing' } }), complete: async () => ({ ok: false as const, message: 'pending' }) });
  await slow.flow.prepare(); const s = await slow.flow.pay(); assert.equal(s.phase, 'failed'); assert.match(s.error!, /do not pay again/);
});
test('unexpected Stripe states and thrown errors fail closed with a generic message', async () => {
  for (const c of [async () => ({ paymentIntent: { id: 'pi_1', status: 'requires_action' } }), async () => ({}), async (): Promise<StripeResult> => { throw new Error('network'); }, async () => ({ paymentIntent: { id: 'pi_1', status: 'requires_payment_method' } })]) {
    const t = mk({ confirm: c }); await t.flow.prepare(); const s = await t.flow.pay(); assert.equal(s.phase, 'failed'); assert.equal(t.calls.complete, 0); assert.ok(s.error);
  }
});
test('session failure is "unavailable" and says the basket is saved', async () => { const t = mk({ create: async () => { throw new Error('503'); } }); const s = await t.flow.prepare(); assert.equal(s.phase, 'unavailable'); assert.match(s.error!, /basket is saved/); });
test('messages: known codes mapped, unknown codes and raw text are never shown', () => { assert.match(messageFor('expired_card'), /expired/); assert.equal(messageFor('weird_internal_code'), messageFor(undefined)); assert.ok(!/weird/.test(messageFor('weird_internal_code'))); assert.match(messageFor(), /not been charged/); });
test('branding: valid hex only, unsafe values fall back; focus ring uses the brand colour', () => { const a = appearance({ primary: '#a1b2c3', background: 'javascript:alert(1)', text: '#000000' }); assert.equal(a.variables.colorPrimary, '#a1b2c3'); assert.equal(a.variables.colorBackground, '#ffffff'); assert.match(a.rules['.Input:focus'].boxShadow, /#a1b2c3/); });
test('server adapter sends no amounts, uses the session cookie, and an idempotency key tied to order and payment', async () => {
  const seen: any[] = []; const client: any = { mutate: async (op: string, q: string, v: any, c: any) => { seen.push({ op, q, v, c }); return { data: op === 'CreatePaymentSession' ? { createPaymentSession: session } : { addPaymentToOrder: { __typename: 'Order', code: 'A1', state: 'PaymentSettled' } } }; }, query: async () => ({ data: { orderByCode: { state: 'PaymentSettled' } } }) };
  const api = checkoutApi(client, 'v1.sess.token'); await api.createSession(); const r = await api.completeOrder('pi_1', 'A1'); assert.equal(r.ok, true);
  assert.equal(seen[0].c.session, 'v1.sess.token'); assert.ok(!/amount|currency|fee|account/i.test(JSON.stringify(seen[0].v)), 'no financial input'); assert.equal(seen[1].c.idempotencyKey, 'pay:A1:pi_1'); assert.deepEqual(seen[1].v, { i: { method: 'stripe-connect', metadata: { paymentIntentId: 'pi_1' } } });
  assert.equal(await api.orderState('A1'), 'PaymentSettled');
});
