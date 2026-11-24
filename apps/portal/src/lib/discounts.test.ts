import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscount, listDiscounts, mapDiscount } from './engine/adapter.ts';

const op = (code: string, args: Record<string, string> = {}) => ({ code, args: Object.entries(args).map(([name, value]) => ({ name, value })) });

test('live discounts map supported engine actions, dates, limits and real order usage', async () => {
  const fixed = mapDiscount({ id: 'p1', name: 'SAVE5', enabled: true, couponCode: 'SAVE5', endsAt: '2027-02-01T00:00:00Z', usageLimit: 12, conditions: [op('minimum_order_amount', { amount: '2500', taxInclusive: 'true' })], actions: [op('oss-fixed-order-discount', { amount: '500' })] }, 3, new Date('2027-01-01T00:00:00Z'));
  assert.deepEqual(fixed, { code: 'SAVE5', kind: 'fixed', value: 500, status: 'active', used: 3, limit: 12, window: 'Ends 1 Feb 2027', minSpendMinor: 2500 });
  assert.equal(mapDiscount({ id: 'x', name: 'x', enabled: true, couponCode: null, conditions: [], actions: [op('free_shipping')] }), null);

  const exec = async (query: string) => query.includes('orders(')
    ? { orders: { items: [{ id: 'o1', orderPlacedAt: '2027-01-01', promotions: [{ id: 'p1' }] }, { id: 'basket', orderPlacedAt: null, promotions: [{ id: 'p1' }] }] } }
    : { promotions: { items: [{ id: 'p1', name: 'TEN', enabled: true, couponCode: 'TEN', startsAt: null, endsAt: null, usageLimit: null, conditions: [], actions: [op('order_percentage_discount', { discount: '10' })] }] } };
  const rows = await listDiscounts(exec as any);
  assert.equal(rows[0].used, 1);
  assert.equal(rows[0].kind, 'percent');
});

test('discount creation validates input and sends only allowlisted engine operations', async () => {
  let input: any;
  const exec = async (query: string, variables?: any) => {
    if (query.includes('query{ promotions')) return { promotions: { items: [] } };
    input = variables.i; return { createPromotion: { __typename: 'Promotion', id: 'p1' } };
  };
  const result = await createDiscount(exec as any, { code: ' spring10 ', kind: 'percent', value: 10, minSpendMinor: 2000, limit: 50, endDate: '2027-04-30' });
  assert.deepEqual(result, { ok: true, message: 'SPRING10 is active.' });
  assert.equal(input.couponCode, 'SPRING10');
  assert.deepEqual(input.actions, [{ code: 'order_percentage_discount', arguments: [{ name: 'discount', value: '10' }] }]);
  assert.equal(input.conditions[0].code, 'minimum_order_amount');
  assert.equal(input.conditions[0].arguments[1].value, 'true');
  assert.equal(input.endsAt, '2027-04-30T23:59:59.999Z');
  assert.equal((await createDiscount(exec as any, { code: 'BAD!', kind: 'percent', value: 10 })).ok, false);
  assert.equal((await createDiscount(exec as any, { code: 'TOO', kind: 'percent', value: 101 })).ok, false);
});
