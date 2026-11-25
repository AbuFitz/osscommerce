import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSee, hiddenFor } from './access';

test('owners see everything; each role is shown only what it can use', () => {
  assert.deepEqual(hiddenFor('owner'), []);
  assert.equal(canSee('manager', '/products'), true); assert.equal(canSee('manager', '/settings/shipping'), false); assert.equal(canSee('manager', '/settings/team'), true); assert.equal(canSee('manager', '/settings/activity'), true);
  assert.equal(canSee('fulfilment', '/orders'), true); assert.equal(canSee('fulfilment', '/customers'), true); assert.equal(canSee('fulfilment', '/discounts'), false); assert.equal(canSee('fulfilment', '/settings/team'), true); assert.equal(canSee('fulfilment', '/settings/preferences'), false);
  assert.equal(canSee('analyst', '/analytics'), true); assert.equal(canSee('analyst', '/automations'), false); assert.equal(canSee('analyst', '/account/billing/invoices'), false);
});
