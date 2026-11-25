import { test } from 'node:test'; import assert from 'node:assert/strict';
import { orderPoints, recentOrders } from './points';
import type { Order } from '../gateway';
const o = (n: number, city: string, cc: string, at: string, total = 1000, extra: Partial<Order> = {}): Order => ({ id: `o${n}`, number: n, placedAt: at, customer: 'x', email: 'x@x', lines: [], shippingMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: total, payment: 'paid', fulfilment: 'unfulfilled', state: 'open', refundedMinor: 0, timeline: [], shipTo: '', ship: { city, country: cc }, ...extra });
test('groups orders by place and sorts by count', () => {
  const p = orderPoints([o(1, 'Bristol', 'GB', '2026-11-20'), o(2, 'bristol', 'GB', '2026-11-22', 500), o(3, 'Paris', 'FR', '2026-11-21')], '2026-11-01');
  assert.equal(p.length, 2); assert.equal(p[0].orders, 2); assert.equal(p[0].salesMinor, 1500); assert.equal(p[0].lastAt, '2026-11-22'); assert.equal(p[1].place, 'Paris, France');
});
test('ignores old, failed, cancelled and unlocatable orders', () => {
  const p = orderPoints([o(1, 'Bristol', 'GB', '2026-09-01'), o(2, 'Bristol', 'GB', '2026-11-02', 1, { payment: 'failed' }), o(3, 'Bristol', 'GB', '2026-11-02', 1, { state: 'cancelled' }), o(4, 'Bristol', 'ZZ', '2026-11-02'), o(5, 'Bristol', 'GB', '2026-11-02', 1, { ship: undefined })], '2026-11-01');
  assert.equal(p.length, 0);
});
test('recent orders, newest first, with a plain label when the address is missing', () => {
  const r = recentOrders([o(1, 'Bristol', 'GB', '2026-11-20'), o(2, '', '', '2026-11-22')]); assert.equal(r[0].number, 2); assert.equal(r[0].place, 'Address not recorded'); assert.equal(r[1].place, 'Bristol, United Kingdom');
});
