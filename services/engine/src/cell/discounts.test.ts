import test from 'node:test';
import assert from 'node:assert/strict';
import { freeUnitsValue } from './discounts.ts';

test('buy 2 get 1: nothing free until a third unit, then one per three', () => {
  assert.equal(freeUnitsValue([1000, 1000], 2, 1), 0); assert.equal(freeUnitsValue([1000, 1000, 1000], 2, 1), 1000); assert.equal(freeUnitsValue(Array(5).fill(1000), 2, 1), 1000); assert.equal(freeUnitsValue(Array(6).fill(1000), 2, 1), 2000);
});
test('the cheapest units are the free ones', () => { assert.equal(freeUnitsValue([3000, 500, 1200], 2, 1), 500); assert.equal(freeUnitsValue([3000, 500, 1200, 900, 100, 4000], 2, 1), 600); });
test('buy 1 get 1 and buy 3 get 2', () => { assert.equal(freeUnitsValue([400, 400, 400, 400], 1, 1), 800); assert.equal(freeUnitsValue(Array(5).fill(100), 3, 2), 200); });
test('invalid offers are free of nothing', () => { assert.equal(freeUnitsValue([100, 100, 100], 0, 1), 0); assert.equal(freeUnitsValue([100, 100, 100], 2, 0), 0); assert.equal(freeUnitsValue([100, 100, 100], 2.5, 1), 0); assert.equal(freeUnitsValue([], 2, 1), 0); });
