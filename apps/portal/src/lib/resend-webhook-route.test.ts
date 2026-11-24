import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESEND_WEBHOOK_BYTES, processResendWebhookRequest } from './resend-webhook-route.ts';

test('Resend route passes the untouched body and all Svix headers to verification', async () => {
  const raw = '{ "type": "email.delivered", "spacing": true }\n';
  let received: unknown;
  const response = await processResendWebhookRequest(new Request('https://portal.test/api/webhooks/resend', {
    method: 'POST', body: raw,
    headers: { 'svix-id': 'evt_1', 'svix-timestamp': '123', 'svix-signature': 'v1,abc' },
  }), async (payload, headers) => { received = { payload, headers }; return { status: 200, body: { received: true } }; });
  assert.deepEqual(received, { payload: raw, headers: { id: 'evt_1', timestamp: '123', signature: 'v1,abc' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Resend route rejects declared and actual oversized bodies before dispatch', async () => {
  let calls = 0; const dispatch = async () => { calls += 1; return { status: 200, body: {} }; };
  const declared = await processResendWebhookRequest(new Request('https://portal.test', { method: 'POST', body: '{}', headers: { 'content-length': String(MAX_RESEND_WEBHOOK_BYTES + 1) } }), dispatch);
  const actual = await processResendWebhookRequest(new Request('https://portal.test', { method: 'POST', body: 'x'.repeat(MAX_RESEND_WEBHOOK_BYTES + 1) }), dispatch);
  assert.equal(declared.status, 413); assert.equal(actual.status, 413); assert.equal(calls, 0);
});
