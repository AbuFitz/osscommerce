import assert from 'node:assert/strict';
import test from 'node:test';
import { LAUNCH_GATES } from './gateway.ts';
import { launchBlockers, withTestOrder } from './launch-readiness.ts';

const readiness = LAUNCH_GATES.map(gate => ({ gate, label: gate, hint: '', done: gate === 'payments_enabled' || gate === 'domain_verified' }));

test('only a successfully paid order proves the test-order gate', () => {
  assert.equal(withTestOrder(readiness, [{ payment: 'failed' } as any]).find(item => item.gate === 'test_order_passed')?.done, false);
  assert.equal(withTestOrder(readiness, [{ payment: 'paid' } as any]).find(item => item.gate === 'test_order_passed')?.done, true);
});

test('merchant launch blockers exclude manual contract and operator approval gates', () => {
  const ready = withTestOrder(readiness, [{ payment: 'paid' } as any]);
  assert.deepEqual(launchBlockers(ready), []);
});
