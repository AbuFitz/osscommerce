import test from 'node:test';
import assert from 'node:assert/strict';
import { appendLog, parseLog, planAdjust, planCount, stockStatus } from './stock.ts';

test('status: untracked, out, backorder, low, ok', () => {
  const b = { onHand: 10, allocated: 2, lowAt: 5, tracked: true, backorder: false };
  assert.equal(stockStatus(b), 'ok'); assert.equal(stockStatus({ ...b, onHand: 7 }), 'low'); assert.equal(stockStatus({ ...b, onHand: 2 }), 'out'); assert.equal(stockStatus({ ...b, onHand: 2, backorder: true }), 'backorder'); assert.equal(stockStatus({ ...b, tracked: false, onHand: 0 }), 'untracked');
});
test('adjusting: set and add, refusing below zero, below reserved, fractions and absurd sizes', () => {
  const cur = { onHand: 10, allocated: 3 };
  assert.deepEqual(planAdjust(cur, { mode: 'add', qty: 5 }), { ok: true, to: 15, delta: 5 }); assert.deepEqual(planAdjust(cur, { mode: 'set', qty: 4 }), { ok: true, to: 4, delta: -6 });
  assert.equal((planAdjust(cur, { mode: 'add', qty: -11 }) as { error: string }).error.includes('below zero'), true); assert.match((planAdjust(cur, { mode: 'set', qty: 2 }) as { error: string }).error, /3 are reserved/);
  assert.equal(planAdjust(cur, { mode: 'add', qty: 1.5 }).ok, false); assert.equal(planAdjust(cur, { mode: 'set', qty: 2_000_000 }).ok, false); assert.match((planAdjust({ onHand: 1, allocated: 1 }, { mode: 'set', qty: 0 }) as { error: string }).error, /1 is reserved/);
});
test('a count changes only what differs, and reports what cannot be applied', () => {
  const rows = [{ variantId: 'a', onHand: 10, allocated: 0 }, { variantId: 'b', onHand: 5, allocated: 2 }, { variantId: 'c', onHand: 0, allocated: 0 }];
  const p = planCount(rows, [{ variantId: 'a', counted: 8 }, { variantId: 'b', counted: 5 }, { variantId: 'c', counted: 12 }, { variantId: 'b', counted: 9 }, { variantId: 'zzz', counted: 1 }]);
  assert.deepEqual(p.changes, [{ variantId: 'a', from: 10, to: 8 }, { variantId: 'c', from: 0, to: 12 }]); assert.equal(p.unchanged, 1); assert.deepEqual(p.problems.map(x => x.variantId), ['b', 'zzz']);
  const low = planCount(rows, [{ variantId: 'b', counted: 1 }]); assert.equal(low.changes.length, 0); assert.match(low.problems[0].error, /reserved/);
});
test('the history keeps the newest entries and a bounded size, and survives bad stored data', () => {
  let raw: string | null = null; for (let i = 0; i < 80; i++) raw = appendLog(raw, { at: `2026-11-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`, from: i, to: i + 1, reason: 'recount', by: 'Mo' });
  const l = parseLog(raw); assert.equal(l.length, 50); assert.equal(l.at(-1)!.to, 80); assert.equal(l[0].from, 30);
  assert.deepEqual(parseLog('not json'), []); assert.deepEqual(parseLog('{"a":1}'), []); assert.deepEqual(parseLog(null), []);
  const big = appendLog(null, { at: '2026-11-01T00:00:00Z', from: 1, to: 2, reason: 'other', note: 'x'.repeat(5000) }); assert.ok(parseLog(big)[0].note!.length <= 200);
});
