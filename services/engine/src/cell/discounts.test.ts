import assert from 'node:assert/strict';
import test from 'node:test';
import { fixedOrderDiscount } from './discounts.ts';

test('fixed discount is tax-aware and can never make the goods subtotal negative', async () => {
  const run = (pricesIncludeTax: boolean, subTotal: number, subTotalWithTax: number, amount: number) => (fixedOrderDiscount as any).execute({ channel: { pricesIncludeTax } }, { subTotal, subTotalWithTax }, [{ name: 'amount', value: String(amount) }], {}, {});
  assert.equal(await run(true, 1000, 1200, 500), -500);
  assert.equal(await run(false, 1000, 1200, 500), -500);
  assert.equal(await run(true, 1000, 1200, 2000), -1200);
  assert.equal(fixedOrderDiscount.code, 'oss-fixed-order-discount');
});
