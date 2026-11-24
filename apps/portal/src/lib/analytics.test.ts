import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, resolveRange, change, toCsv, ymd } from './analytics.ts';
import type { Order } from './gateway.ts';

const mk = (id: string, iso: string, email: string, total: number, o: Partial<Order> = {}): Order => ({ id, number: Number(id.slice(1)), placedAt: iso, customer: email, email, lines: [{ sku: 's', title: 'Mug', qty: 2, unitMinor: total / 2 }], shippingMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: total, payment: 'paid', fulfilment: 'fulfilled', state: 'completed', refundedMinor: 0, timeline: [], shipTo: '', ...o });
const orders = [
  mk('o1', '2026-11-10T10:00:00Z', 'a@x.com', 4000), mk('o2', '2026-11-12T10:00:00Z', 'b@x.com', 6000, { refundedMinor: 1000, payment: 'partially_refunded' }),
  mk('o3', '2026-11-12T15:00:00Z', 'a@x.com', 2000, { discountMinor: 200 }), mk('o4', '2026-11-13T10:00:00Z', 'c@x.com', 9999, { payment: 'failed', state: 'cancelled' }),
  mk('o5', '2026-11-01T10:00:00Z', 'a@x.com', 1000),
];

test('range: presets, custom, and bad input fall back to 30 days', () => {
  assert.deepEqual(resolveRange({ range: '7d' }, '2026-11-14'), { from: '2026-11-08', to: '2026-11-14', label: 'Last 7 days' });
  assert.equal(resolveRange({ range: 'nonsense' }, '2026-11-14').from, '2026-10-16');
  assert.deepEqual(resolveRange({ from: '2026-11-01', to: '2026-11-05' }, '2026-11-14'), { from: '2026-11-01', to: '2026-11-05', label: 'Custom range' });
  assert.equal(resolveRange({ from: '2026-11-09', to: '2026-11-01' }, '2026-11-14').label, 'Last 30 days');
  assert.equal(resolveRange({ from: '2026-11-01', to: '2030-01-01' }, '2026-11-14').to, '2026-11-14');
});
test('report: totals, failed payments excluded, refunds reduce net, previous period compared', () => {
  const r = buildReport(orders, { from: '2026-11-08', to: '2026-11-14' });
  assert.equal(r.days, 7); assert.equal(r.series.length, 7); assert.equal(r.prev.length, 7);
  assert.equal(r.totals.orders, 3); assert.equal(r.totals.gross, 12000); assert.equal(r.totals.refunds, 1000); assert.equal(r.totals.net, 11000);
  assert.equal(r.totals.aov, 4000); assert.equal(r.totals.customers, 2);
  assert.equal(r.prevTotals.orders, 1); assert.equal(r.prevTotals.gross, 1000);
  assert.equal(r.series.find(d => d.day === '2026-11-12')!.orders, 2);
});
test('report: new versus returning uses each customer\'s first order ever, not just in range', () => {
  const r = buildReport(orders, { from: '2026-11-08', to: '2026-11-14' });
  assert.equal(r.customers.new, 1); assert.equal(r.customers.returning, 2);   // b is new; a already ordered on the 1st
});
test('report: breakdowns', () => {
  const r = buildReport(orders, { from: '2026-11-08', to: '2026-11-14' });
  assert.equal(r.topProducts[0].units, 6); assert.equal(r.discounts.orders, 1); assert.equal(r.discounts.amount, 200);
  assert.equal(r.weekday.reduce((s, w) => s + w.orders, 0), 3);
});
test('report: empty store is not an error', () => { const r = buildReport([], { from: '2026-11-08', to: '2026-11-14' }); assert.equal(r.hasData, false); assert.equal(r.totals.aov, 0); });
test('change: percent, no divide by zero', () => { assert.equal(change(150, 100), 50); assert.equal(change(0, 0), 0); assert.equal(change(5, 0), null); });
test('days are London calendar days across the clock change', () => { assert.equal(ymd('2026-03-29T23:30:00Z'), '2026-03-30'); assert.equal(ymd('2026-11-14T23:30:00Z'), '2026-11-14'); });
test('csv has a header and one line per day', () => { const c = toCsv(buildReport(orders, { from: '2026-11-08', to: '2026-11-14' })).trim().split('\n'); assert.equal(c.length, 8); assert.ok(c[0].startsWith('Date,')); });
