import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from './smart.ts';
import type { StoreView, Summary } from './gateway.ts';

const base = (over: Partial<{ payments: boolean; live: boolean }> = {}): StoreView => ({
  name: 't', store: { lifecycle: over.live ? 'live' : 'configuring', paymentReadiness: 'enabled' } as StoreView['store'],
  readiness: [{ gate: 'payments_enabled', label: '', hint: '', done: over.payments ?? true }, { gate: 'domain_verified', label: '', hint: '', done: !!over.live }],
});
const sum = (o: Partial<Summary> = {}): Summary => ({ netMinor: 0, grossMinor: 0, orders: 0, aovMinor: 0, refundedMinor: 0, toFulfil: 0, lowStock: 0, fulfilled: 0, paidOrders: 0, series: [], topProducts: [], statusMix: [], asOf: '', ...o });

test('empty store leads with first product', () => assert.equal(plan({ store: base({ payments: false }), summary: sum(), products: 0, orders: 0, failed: 0 }).hero, 'first_product'));
test('products but no payments leads with connect payments', () => assert.equal(plan({ store: base({ payments: false }), summary: sum(), products: 3, orders: 0, failed: 0 }).hero, 'connect_payments'));
test('orders waiting lead with fulfil', () => assert.equal(plan({ store: base(), summary: sum({ toFulfil: 2, orders: 5 }), products: 3, orders: 5, failed: 0 }).hero, 'fulfil'));
test('live store hides setup checklist', () => assert.equal(plan({ store: base({ live: true }), summary: sum(), products: 3, orders: 5, failed: 0 }).showSetup, false));
test('no refunds and no low stock: those KPIs are not shown', () => {
  const k = plan({ store: base({ live: true }), summary: sum({ orders: 9 }), products: 3, orders: 9, failed: 0 }).kpis;
  assert.ok(!k.includes('refunded') && !k.includes('lowStock'));
});
test('failed payments always surface as attention', () => assert.equal(plan({ store: base({ live: true }), summary: sum(), products: 3, orders: 9, failed: 2 }).attention.length, 1));
test('charts need at least three orders', () => assert.equal(plan({ store: base(), summary: sum(), products: 3, orders: 2, failed: 0 }).showCharts, false));
