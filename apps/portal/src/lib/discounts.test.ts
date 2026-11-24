import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDiscount, statusOf, validateDiscount } from './discounts.ts';
import type { DiscountInput } from './gateway.ts';

const base: DiscountInput = { method: 'code', code: 'SUMMER', kind: 'percent', value: 20, enabled: true };
const T = '2026-11-14';
test('valid discounts pass', () => { assert.equal(validateDiscount(base, T), null); assert.equal(validateDiscount({ ...base, method: 'automatic', code: undefined }, T), null); });
test('codes: 2 to 24 letters and numbers, only when the method is a code', () => {
  assert.ok(validateDiscount({ ...base, code: 'a' }, T)); assert.ok(validateDiscount({ ...base, code: 'has space' }, T)); assert.equal(validateDiscount({ ...base, code: 'ok2' }, T), null);
  assert.equal(validateDiscount({ ...base, method: 'automatic', code: '!!' }, T), null);
});
test('percent and fixed amounts are range-checked', () => {
  assert.ok(validateDiscount({ ...base, value: 0 }, T)); assert.ok(validateDiscount({ ...base, value: 101 }, T));
  assert.ok(validateDiscount({ ...base, kind: 'fixed', value: 0 }, T)); assert.ok(validateDiscount({ ...base, kind: 'fixed', value: 2.5 }, T)); assert.equal(validateDiscount({ ...base, kind: 'fixed', value: 500 }, T), null);
});
test('buy X get Y needs both numbers and some products', () => {
  assert.ok(validateDiscount({ ...base, kind: 'bogo', value: 0 }, T)); assert.ok(validateDiscount({ ...base, kind: 'bogo', value: 0, buy: 2, get: 1 }, T), 'no products');
  assert.equal(validateDiscount({ ...base, kind: 'bogo', value: 0, buy: 2, get: 1, productIds: ['p1'] }, T), null);
});
test('scope rules: fixed and shipping apply to the whole order', () => { assert.ok(validateDiscount({ ...base, kind: 'fixed', value: 500, productIds: ['p1'] }, T)); assert.ok(validateDiscount({ ...base, kind: 'shipping', value: 0, productIds: ['p1'] }, T)); });
test('dates: valid, ordered, and not already over', () => {
  assert.ok(validateDiscount({ ...base, endDate: '2026-11-01' }, T)); assert.ok(validateDiscount({ ...base, startDate: '2026-12-01', endDate: '2026-11-20' }, T)); assert.ok(validateDiscount({ ...base, startDate: 'nope' }, T));
  assert.equal(validateDiscount({ ...base, endDate: '2026-11-01', enabled: false }, T), null, 'a paused, finished discount can be saved');
});
test('limits are whole numbers of at least one', () => { assert.ok(validateDiscount({ ...base, limit: 0 }, T)); assert.ok(validateDiscount({ ...base, perCustomer: 1.5 }, T)); assert.equal(validateDiscount({ ...base, limit: 5, perCustomer: 1 }, T), null); });
test('the sentence reads back what was set up', () => {
  assert.equal(describeDiscount({ ...base, minSpendMinor: 5000, endDate: '2026-12-31', perCustomer: 1 }), '20% off the whole order on orders over £50 with code SUMMER, until 31 Dec 2026 (1 per customer).');
  assert.equal(describeDiscount({ method: 'automatic', kind: 'bogo', value: 0, buy: 2, get: 1, productNames: ['Tea towel set'] }), 'Buy 2, get 1 free on Tea towel set, applied automatically.');
  assert.equal(describeDiscount({ method: 'code', code: 'ship', kind: 'shipping', value: 0 }), 'Free delivery with code SHIP.');
});
test('status: paused, scheduled, active, expired', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  assert.equal(statusOf({ enabled: true }, now), 'active'); assert.equal(statusOf({ enabled: false }, now), 'paused'); assert.equal(statusOf({ enabled: true, startsAt: '2026-12-01T00:00:00Z' }, now), 'scheduled'); assert.equal(statusOf({ enabled: true, endsAt: '2026-11-01T00:00:00Z' }, now), 'expired');
});
