import test from 'node:test'; import assert from 'node:assert/strict';
import { zoneEligible } from './shipping.ts';
const uk = { countries: 'GB' }; const at = (o: Partial<Parameters<typeof zoneEligible>[1]> = {}) => ({ countryCode: 'GB', postalCode: 'BS1 4AX', basketMinor: 3000, weightGrams: 500, ...o });
test('a zone with only countries behaves as it always did', () => { assert.equal(zoneEligible(uk, at()), true); assert.equal(zoneEligible(uk, at({ countryCode: 'FR' })), false); assert.equal(zoneEligible(uk, at({ countryCode: undefined })), false); });
test('postcode areas: only these, and never these', () => {
  const highlands = { ...uk, postcodes: 'IV, KW, HS, PA20–80' }; assert.equal(zoneEligible(highlands, at({ postalCode: 'IV2 3AB' })), true); assert.equal(zoneEligible(highlands, at({ postalCode: 'PA19 1AA' })), false); assert.equal(zoneEligible(highlands, at({ postalCode: '' })), false);
  const mainland = { ...uk, excludePostcodes: 'IV, KW, HS' }; assert.equal(zoneEligible(mainland, at({ postalCode: 'IV2 3AB' })), false); assert.equal(zoneEligible(mainland, at({ postalCode: 'BS1 4AX' })), true);
});
test('order value limits are inclusive at both ends and zero means none', () => {
  const mid = { ...uk, minOrder: 3000, maxOrder: 6000 }; assert.equal(zoneEligible(mid, at({ basketMinor: 3000 })), true); assert.equal(zoneEligible(mid, at({ basketMinor: 2999 })), false); assert.equal(zoneEligible(mid, at({ basketMinor: 6000 })), true); assert.equal(zoneEligible(mid, at({ basketMinor: 6001 })), false);
  assert.equal(zoneEligible({ ...uk, minOrder: 0, maxOrder: 0 }, at({ basketMinor: 999999 })), true);
});
test('weight limit', () => { const light = { ...uk, maxWeight: 2000 }; assert.equal(zoneEligible(light, at({ weightGrams: 2000 })), true); assert.equal(zoneEligible(light, at({ weightGrams: 2001 })), false); });
test('limits combine', () => { const r = { ...uk, excludePostcodes: 'BT', minOrder: 2000, maxWeight: 5000 }; assert.equal(zoneEligible(r, at({ postalCode: 'BT1 1AA' })), false); assert.equal(zoneEligible(r, at({ basketMinor: 1000 })), false); assert.equal(zoneEligible(r, at()), true); });
