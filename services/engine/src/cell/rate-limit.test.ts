import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Limiter } from './rate-limit.ts';

test('a limiter allows its quota, then says how long to wait, then forgives when the window ends', () => {
  let t = 1000; const l = new Limiter(3, 60_000, () => t);
  assert.deepEqual([l.hit('a'), l.hit('a'), l.hit('a')], [0, 0, 0]); assert.equal(l.hit('a'), 60); t += 30_000; assert.equal(l.hit('a'), 30);
  assert.equal(l.hit('b'), 0, 'keys are independent'); t += 31_000; assert.equal(l.hit('a'), 0, 'a new window starts clean');
});
test('clearing a key forgives it at once', () => { const l = new Limiter(1, 60_000, () => 0); l.hit('k'); assert.ok(l.hit('k') > 0); l.clear('k'); assert.equal(l.hit('k'), 0); });
