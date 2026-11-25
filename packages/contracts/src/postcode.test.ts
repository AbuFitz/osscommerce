import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostcode, zoneForPostcode } from './postcode.ts';
const zones = [{ name: 'UK', regions: 'England, Scotland, Wales, Northern Ireland' }, { name: 'Highlands', regions: 'IV, KW, HS, ZE, PA20–80' }, { name: 'Central London', regions: 'SW1A, EC1' }];
test('parses full and partial postcodes', () => { assert.deepEqual(parsePostcode('iv2 3ab'), { area: 'IV', district: 2, suffix: '' }); assert.deepEqual(parsePostcode('SW1A 1AA'), { area: 'SW', district: 1, suffix: 'A' }); assert.equal(parsePostcode('hello'), null); });
test('an area token beats the catch-all', () => assert.equal(zoneForPostcode('IV2 3AB', zones).zone?.name, 'Highlands'));
test('district ranges include both ends and exclude outside', () => { assert.equal(zoneForPostcode('PA20 1AA', zones).zone?.name, 'Highlands'); assert.equal(zoneForPostcode('PA80 1AA', zones).zone?.name, 'Highlands'); assert.equal(zoneForPostcode('PA19 1AA', zones).zone?.name, 'UK'); });
test('outward code beats area; unlisted falls back', () => { assert.equal(zoneForPostcode('SW1A 1AA', zones).zone?.name, 'Central London'); assert.equal(zoneForPostcode('SW1B 1AA', zones).via, 'fallback'); });
test('no zone and no catch-all means not served; garbage is invalid', () => { assert.equal(zoneForPostcode('M1 1AA', zones.slice(1)).via, 'none'); assert.equal(zoneForPostcode('nope', zones).invalid, true); });
import { postcodeMatches, postcodeTokens } from './postcode.ts';
test('postcodeMatches: areas, ranges and outward codes, and nothing for catch-alls', () => {
  assert.equal(postcodeMatches('IV2 3AB', 'IV, KW, HS'), true); assert.equal(postcodeMatches('B1 1AA', 'BT'), false, 'B is not BT');
  assert.equal(postcodeMatches('PA20 1AA', 'PA20–80'), true); assert.equal(postcodeMatches('PA19 1AA', 'PA20–80'), false);
  assert.equal(postcodeMatches('SW1A 1AA', 'SW1A'), true); assert.equal(postcodeMatches('SW1B 1AA', 'SW1A'), false); assert.equal(postcodeMatches('EH10 4AA', 'EH1'), false, 'EH1 is not EH10');
  assert.equal(postcodeMatches('IV2 3AB', 'United Kingdom'), false); assert.equal(postcodeMatches('nope', 'IV'), false); assert.equal(postcodeTokens('IV, UK, PA20-80').length, 2);
});
