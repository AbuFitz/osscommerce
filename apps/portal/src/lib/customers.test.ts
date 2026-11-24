import test from 'node:test';
import assert from 'node:assert/strict';
import { countBySegment, csvText, matches, segmentsOf } from './customers.ts';
import type { Customer } from './gateway.ts';

const NOW = new Date('2026-11-14T12:00:00Z');
const c = (id: string, orders: number, spent: number, last: string): Customer => ({ id, name: `Cust ${id}`, email: `${id}@x.com`, orders, spentMinor: spent, lastOrder: last, marketing: false });
const list = [c('a', 1, 1000, '2026-11-10T00:00:00Z'), c('b', 3, 9000, '2026-11-01T00:00:00Z'), c('c', 2, 3000, '2026-08-01T00:00:00Z'), c('d', 1, 500, '2026-06-01T00:00:00Z'), c('e', 5, 50000, '2026-11-13T00:00:00Z'), c('f', 1, 700, '2026-11-12T00:00:00Z')];
test('segments: new, returning, top spenders, not back in 60 days', () => {
  const m = segmentsOf(list, NOW); const has = (id: string, k: string) => m.get(id)!.has(k as never);
  assert.ok(has('a', 'new')); assert.ok(!has('d', 'new'), 'one old order is not new'); assert.ok(has('b', 'returning')); assert.ok(!has('a', 'returning'));
  assert.ok(has('e', 'top')); assert.ok(!has('b', 'top')); assert.ok(has('c', 'inactive')); assert.ok(has('d', 'inactive')); assert.ok(!has('e', 'inactive'));
});
test('top spenders need enough customers to mean something', () => { const m = segmentsOf(list.slice(0, 3), NOW); assert.equal([...m.values()].filter(s => s.has('top')).length, 0); });
test('counts add up', () => { const n = countBySegment(segmentsOf(list, NOW)); assert.equal(n.all, 6); assert.equal(n.returning, 3); assert.equal(n.inactive, 2); });
test('search matches name or email, ignoring case', () => { assert.ok(matches(list[0], 'CUST A')); assert.ok(matches(list[0], 'a@x')); assert.ok(!matches(list[0], 'zzz')); assert.ok(matches(list[0], '  ')); });
test('csv text is safe from formula injection and quotes', () => { assert.equal(csvText('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"'); assert.equal(csvText('+44 7000'), "'+44 7000"); assert.equal(csvText('Lee, Maya'), '"Lee, Maya"'); assert.equal(csvText('Maya'), 'Maya'); });
