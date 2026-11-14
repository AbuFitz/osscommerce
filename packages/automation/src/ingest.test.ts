import test from 'node:test';
import assert from 'node:assert/strict';
import { sign } from '@oss-commerce/storefront-sdk';
import { handleIngest } from './ingest.ts';

const secret = 'c'.repeat(43);
function setup() { const handled: any[] = []; return { handled, d: { engine: { handleEvent: async (e: any) => { handled.push(e); return []; } }, cellSecret: async (id: string) => (id === 'cell_a' ? { secret, storeId: 'store_a' } : null) } as any }; }
const ev = (o: any = {}) => ({ id: 'evt_00000001', storeId: 'store_a', type: 'order.paid', occurredAt: '2026-11-14T12:00:00Z', ...o });
const body = (events: any[], cellId = 'cell_a') => JSON.stringify({ cellId, events });

test('signed batch from the right cell is accepted and handed to the engine', async () => {
  const { d, handled } = setup(); const b = body([ev(), ev({ id: 'evt_00000002' })]); const r = await handleIngest(d, b, sign(secret, b));
  assert.equal(r.status, 200); assert.equal(handled.length, 2);
});
test('unsigned, wrongly signed, stale, and unknown-cell batches are all 401 and reach nothing', async () => {
  const { d, handled } = setup(); const b = body([ev()]);
  assert.equal((await handleIngest(d, b, null)).status, 401); assert.equal((await handleIngest(d, b, sign('x'.repeat(43), b))).status, 401);
  assert.equal((await handleIngest(d, b, sign(secret, b, Math.floor(Date.now() / 1000) - 3600))).status, 401);
  const u = body([ev()], 'cell_zzz'); assert.equal((await handleIngest(d, u, sign(secret, u))).status, 401); assert.equal(handled.length, 0);
});
test('a cell cannot fire automations for another merchant', async () => {
  const { d, handled } = setup(); const b = body([ev({ id: 'evt_00000009', storeId: 'store_b' }), ev()]); const r = await handleIngest(d, b, sign(secret, b));
  assert.equal(r.status, 207); assert.deepEqual(r.body.rejected, [{ id: 'evt_00000009', reason: 'wrong_store' }]); assert.equal(handled.length, 1);
});
test('malformed events are rejected individually; empty and oversized batches are refused', async () => {
  const { d } = setup(); const b = body([{ nope: 1 }, ev()]); assert.equal((await handleIngest(d, b, sign(secret, b))).status, 207);
  const e = body([]); assert.equal((await handleIngest(d, e, sign(secret, e))).status, 400);
  const big = body(Array.from({ length: 51 }, (_, i) => ev({ id: `evt_${String(i).padStart(8, '0')}` }))); assert.equal((await handleIngest(d, big, sign(secret, big))).status, 400);
});
