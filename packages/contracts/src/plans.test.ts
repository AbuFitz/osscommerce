import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PLANS, resolveAgreement, feeMinor, hasFeature, MerchantAgreement } from './plans.ts';

const [commerce, plus] = SEED_PLANS;
const agr = (o: Partial<MerchantAgreement> = {}): MerchantAgreement => ({ storeId: 's', planId: 'commerce', effectiveFrom: '2026-01-01', overrides: {}, promotions: [], ...o });
const T = new Date('2026-06-01');

test('standard plan: £49.99 and 0.5%', () => { const r = resolveAgreement(commerce, agr(), T); assert.equal(r.monthlyMinor, 4999); assert.equal(r.feeBp, 50); });
test('0.5% on £2,000 is £10', () => assert.equal(feeMinor(200000, 50), 1000));
test('volume tier lowers the fee on Plus', () => { assert.equal(resolveAgreement(plus, agr({ planId: 'plus' }), T, 0).feeBp, 40); assert.equal(resolveAgreement(plus, agr({ planId: 'plus' }), T, 6_000_000).feeBp, 30); });
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
