import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PLANS, resolveAgreement, feeMinor, feeRefundMinor, hasFeature, MerchantAgreement } from './plans.ts';

const [commerce, plus] = SEED_PLANS;
const agr = (o: Partial<MerchantAgreement> = {}): MerchantAgreement => ({ storeId: 's', planId: 'commerce', effectiveFrom: '2026-01-01', overrides: {}, promotions: [], ...o });
const T = new Date('2026-06-01');

test('standard plan: £49.99 and 0.5%', () => { const r = resolveAgreement(commerce, agr(), T); assert.equal(r.monthlyMinor, 4999); assert.equal(r.feeBp, 50); });
test('0.5% on £2,000 is £10', () => assert.equal(feeMinor(200000, 50), 1000));
test('Plus: 0.3%, falling to 0.2% from £100,000 a month', () => { assert.equal(resolveAgreement(plus, agr({ planId: 'plus' }), T, 0).feeBp, 30); assert.equal(resolveAgreement(plus, agr({ planId: 'plus' }), T, 9_999_999).feeBp, 30); assert.equal(resolveAgreement(plus, agr({ planId: 'plus' }), T, 10_000_000).feeBp, 20); });
test('custom override beats the plan', () => assert.equal(resolveAgreement(commerce, agr({ overrides: { monthlyMinor: 3999, feeBp: 25 } }), T).feeBp, 25));
test('active fee promotion beats an override; expired promotion is ignored', () => {
  const promo = { id: 'p', kind: 'fee_bp_override' as const, value: 0, validFrom: '2026-05-01', validTo: '2026-07-01' };
  assert.equal(resolveAgreement(commerce, agr({ overrides: { feeBp: 25 }, promotions: [promo] }), T).feeBp, 0);
  assert.equal(resolveAgreement(commerce, agr({ promotions: [{ ...promo, validTo: '2026-05-15' }] }), T).feeBp, 50);
});
test('free months make the subscription zero without touching the fee', () => { const r = resolveAgreement(commerce, agr({ promotions: [{ id: 'f', kind: 'months_free', value: 1, validFrom: '2026-05-01', validTo: '2026-07-01' }] }), T); assert.equal(r.monthlyMinor, 0); assert.equal(r.feeBp, 50); });
test('entitlements: Plus has advanced reporting, Commerce does not; overrides can grant it', () => {
  assert.ok(hasFeature(resolveAgreement(plus, agr({ planId: 'plus' }), T).entitlements, 'advanced_reporting'));
  assert.ok(!hasFeature(resolveAgreement(commerce, agr(), T).entitlements, 'advanced_reporting'));
  assert.ok(hasFeature(resolveAgreement(commerce, agr({ overrides: { entitlements: { features: ['advanced_reporting'] } } }), T).entitlements, 'advanced_reporting'));
});

test('refunds return our fee by default, in proportion', () => {
  assert.equal(feeRefundMinor({ chargeMinor: 10000, feeMinor: 50, refundMinor: 10000, refundsReturnFee: true }), 50);
  assert.equal(feeRefundMinor({ chargeMinor: 10000, feeMinor: 50, refundMinor: 2500, refundsReturnFee: true }), 12);
  assert.equal(feeRefundMinor({ chargeMinor: 10000, feeMinor: 50, refundMinor: 99999, refundsReturnFee: true }), 50, 'cannot exceed the fee');
  assert.equal(feeRefundMinor({ chargeMinor: 10000, feeMinor: 50, refundMinor: 5000, refundsReturnFee: false }), 0);
  assert.ok(plus.fee.refundsReturnFee && commerce.fee.refundsReturnFee);
});

import { validateDraft, combinations } from './catalogue.ts';
test('catalogue rules live in contracts: variants must pick one value per group, with unique combinations', () => {
  const d = { title: 'Tee', optionGroups: [{ name: 'Size', options: ['S', 'M'] }], variants: [{ options: ['S'], sku: 'A', priceMinor: 1, stock: 1 }, { options: ['S'], sku: 'B', priceMinor: 1, stock: 1 }] };
  assert.match(validateDraft(d).join(' '), /already exists/); assert.equal(combinations([{ name: 'a', options: ['1', '2'] }, { name: 'b', options: ['x'] }]).length, 2);
});
