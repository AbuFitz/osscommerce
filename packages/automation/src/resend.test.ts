import assert from 'node:assert/strict';
import test from 'node:test';
import { PermanentError, TransientError } from './model.ts';
import { handleResendWebhook, ResendSender, suppressionFromResendEvent, verifyResendWebhook, type ResendClient } from './resend.ts';

const request = {
  storeId: 'store_a', template: 'order_confirmation', to: 'buyer@shop.test', audience: 'shopper' as const,
  data: {}, idempotencyKey: 'store_a/order/42', headers: { 'List-Unsubscribe': '<https://shop.test/u>' },
};
const prepared = { from: 'Kiln & Thread <orders@shop.test>', subject: 'Order confirmed', html: '<p>Paid</p>', text: 'Paid', replyTo: 'help@shop.test' };
const key = ['re', 'unitfixtureabcdefghijklmnop'].join('_');

function fake(result: { data: { id: string } | null; error: { name?: string; message?: string; statusCode?: number } | null }) {
  const calls: unknown[][] = [];
  const client = {
    emails: { send: async (...args: unknown[]) => { calls.push(args); return result; } },
    webhooks: { verify: (input: unknown) => ({ type: 'email.delivered', input }) },
  } as unknown as ResendClient;
  return { client, calls };
}

test('Resend sender forwards rendered mail, headers and provider idempotency and returns the provider id', async () => {
  const f = fake({ data: { id: 'email_42' }, error: null });
  const sender = new ResendSender({ apiKey: key, client: f.client, prepare: async () => prepared });
  assert.deepEqual(await sender.send(request), { messageId: 'email_42' });
  assert.deepEqual(f.calls[0][0], { ...prepared, to: request.to, headers: request.headers });
  assert.deepEqual(f.calls[0][1], { idempotencyKey: request.idempotencyKey });
});

test('Resend sender classifies retryable and permanent provider failures', async () => {
  const retry = fake({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' } });
  await assert.rejects(new ResendSender({ apiKey: key, client: retry.client, prepare: async () => prepared }).send(request), TransientError);
  const bad = fake({ data: null, error: { name: 'validation_error', statusCode: 422, message: 'bad sender' } });
  await assert.rejects(new ResendSender({ apiKey: key, client: bad.client, prepare: async () => prepared }).send(request), PermanentError);
});

test('webhook verification uses the untouched payload and all Svix headers', () => {
  const f = fake({ data: null, error: null });
  const payload = '{"type":"email.delivered"}';
  const secret = ['whsec', 'unitfixtureabcdefghijkl'].join('_');
  const out = verifyResendWebhook(f.client, payload, { id: 'msg_1', timestamp: '123', signature: 'v1,abc' }, secret) as { input: { payload: string } };
  assert.equal(out.input.payload, payload);
  assert.throws(() => verifyResendWebhook(f.client, payload, {}, secret), PermanentError);
});

test('only bounce, complaint and unsubscribe events create suppressions', () => {
  assert.deepEqual(suppressionFromResendEvent({ type: 'email.bounced', data: { to: ['a@shop.test'] } }), { email: 'a@shop.test', reason: 'bounce' });
  assert.deepEqual(suppressionFromResendEvent({ type: 'email.complained', data: { to: ['a@shop.test'] } }), { email: 'a@shop.test', reason: 'complaint' });
  assert.deepEqual(suppressionFromResendEvent({ type: 'contact.updated', data: { email: 'a@shop.test', unsubscribed: true } }), { email: 'a@shop.test', reason: 'unsubscribe' });
  assert.equal(suppressionFromResendEvent({ type: 'email.delivered', data: { to: ['a@shop.test'] } }), null);
});

test('webhook ingestion resolves the store from the sent message, applies suppressions atomically, and deduplicates replays', async () => {
  const payload = '{"type":"email.bounced"}'; const applied: unknown[] = [];
  const deps = {
    client: { webhooks: { verify: () => ({ type: 'email.bounced', data: { email_id: 'email_42', to: ['a@shop.test'] } }) } },
    webhookSecret: ['whsec', 'unitfixtureabcdefghijkl'].join('_'),
    resolveStore: async (messageId: string) => messageId === 'email_42' ? 'store_a' : null,
    apply: async (input: unknown) => { applied.push(input); return applied.length === 1 ? 'applied' as const : 'duplicate' as const; },
  };
  const headers = { id: 'evt_1', timestamp: '123', signature: 'v1,abc' };
  assert.deepEqual(await handleResendWebhook(deps, payload, headers), { status: 200, body: { received: true, duplicate: false } });
  assert.deepEqual(applied[0], { providerEventId: 'evt_1', storeId: 'store_a', messageId: 'email_42', type: 'email.bounced', suppression: { email: 'a@shop.test', reason: 'bounce' } });
  assert.deepEqual(await handleResendWebhook(deps, payload, headers), { status: 200, body: { received: true, duplicate: true } });
});

test('unknown provider messages are acknowledged without tenant mutation', async () => {
  let changed = false;
  const out = await handleResendWebhook({
    client: { webhooks: { verify: () => ({ type: 'email.delivered', data: { email_id: 'foreign' } }) } },
    webhookSecret: ['whsec', 'unitfixtureabcdefghijkl'].join('_'), resolveStore: async () => null,
    apply: async () => { changed = true; return 'applied'; },
  }, '{}', { id: 'evt_x', timestamp: '123', signature: 'v1,abc' });
  assert.deepEqual(out, { status: 202, body: { received: true, ignored: true } });
  assert.equal(changed, false);
});
