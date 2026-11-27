import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSegment as v, inSegment, describeSegment, type SegmentDefinition } from './segments.ts';

const NOW = new Date('2026-11-27T12:00:00Z'); const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const c = (o: Partial<{ orders: number; spentMinor: number; lastOrder: string; marketing: boolean }> = {}) => ({ orders: 3, spentMinor: 15_000, lastOrder: ago(20), marketing: true, ...o });

test('rules match on orders, spend, recency and consent; all vs any', () => {
  const big: SegmentDefinition = { match: 'all', rules: [{ field: 'spent', op: 'gte', value: 100 }, { field: 'orders', op: 'gte', value: 2 }] };
  assert.equal(inSegment(c(), big, NOW), true); assert.equal(inSegment(c({ spentMinor: 9_999 }), big, NOW), false); assert.equal(inSegment(c({ orders: 1 }), big, NOW), false);
  assert.equal(inSegment(c({ orders: 1 }), { ...big, match: 'any' }, NOW), true, 'any: spending alone is enough');
  const lapsed: SegmentDefinition = { match: 'all', rules: [{ field: 'daysSinceOrder', op: 'gte', value: 60 }] };
  assert.equal(inSegment(c({ lastOrder: ago(61) }), lapsed, NOW), true); assert.equal(inSegment(c({ lastOrder: ago(59) }), lapsed, NOW), false); assert.equal(inSegment(c({ lastOrder: '' }), lapsed, NOW), true, 'never ordered counts as lapsed');
  const mk: SegmentDefinition = { match: 'all', rules: [{ field: 'marketing', op: 'eq', value: 1 }] }; assert.equal(inSegment(c(), mk, NOW), true); assert.equal(inSegment(c({ marketing: false }), mk, NOW), false);
});
test('mistakes are explained, and nothing odd gets through', () => {
  const ok = { match: 'all', rules: [{ field: 'orders', op: 'gte', value: 2 }] };
  assert.equal(v('VIPs', ok), null); assert.match(v('', ok)!, /name/); assert.match(v('x'.repeat(61), ok)!, /60/);
  assert.match(v('a', { match: 'all', rules: [] })!, /at least one/); assert.match(v('a', { match: 'all', rules: Array(9).fill(ok.rules[0]) })!, /at most 8/);
  assert.match(v('a', { match: 'some', rules: ok.rules })!, /not valid/); assert.match(v('a', null)!, /not valid/); assert.match(v('a', { match: 'all', rules: [{ field: 'email', op: 'eq', value: 1 }] })!, /cannot filter/);
  assert.match(v('a', { match: 'all', rules: [{ field: 'spent', op: 'eq', value: 1 }] })!, /cannot be/); assert.match(v('a', { match: 'all', rules: [{ field: 'orders', op: 'gte', value: -1 }] })!, /0 to/);
  assert.match(v('a', { match: 'all', rules: [{ field: 'orders', op: 'gte', value: 1.5 }] })!, /whole number/); assert.match(v('a', { match: 'all', rules: [{ field: 'orders', op: 'gte', value: NaN }] })!, /0 to/); assert.match(v('a', { match: 'all', rules: [{ field: 'marketing', op: 'eq', value: 2 }] })!, /0 to 1/);
  assert.equal(v('a', { match: 'all', rules: [{ field: 'spent', op: 'gte', value: 49.5 }] }), null, 'pounds may have pence');
});
test('a segment reads back in plain words', () => {
  assert.equal(describeSegment({ match: 'all', rules: [{ field: 'spent', op: 'gte', value: 1000 }, { field: 'daysSinceOrder', op: 'lte', value: 30 }] }), 'Total spent at least £1,000 and Days since last order at most 30 days');
  assert.equal(describeSegment({ match: 'any', rules: [{ field: 'marketing', op: 'eq', value: 0 }, { field: 'orders', op: 'eq', value: 1 }] }), 'Has not agreed to marketing email or Number of orders is exactly 1 order');
});
