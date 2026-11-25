import test from 'node:test'; import assert from 'node:assert/strict';
import { describeWhen, describePrice, validateRate, splitRegions, exclusionsFor, bandsJson, bandsFromJson } from './delivery.ts';
const countries = [{ code: 'GB', name: 'United Kingdom', enabled: true }, { code: 'IE', name: 'Ireland', enabled: true }, { code: 'IM', name: 'Isle of Man', enabled: true }, { code: 'FR', name: 'France', enabled: false }];
test('describes when an option is offered', () => { assert.equal(describeWhen(), ''); assert.equal(describeWhen({ minOrderMinor: 3000, maxOrderMinor: 6000 }), 'orders £30 to £60'); assert.equal(describeWhen({ maxOrderMinor: 2999, maxWeightGrams: 2000 }), 'orders up to £29.99, up to 2 kg'); assert.equal(describeWhen({ maxWeightGrams: 750 }), 'up to 750 g'); });
test('describes prices', () => { assert.equal(describePrice({ label: 'x', priceMinor: 0 }), 'Free'); assert.equal(describePrice({ label: 'x', priceMinor: 495 }), '£4.95'); assert.equal(describePrice({ label: 'x', priceMinor: 0, bands: [{ upToGrams: 500, priceMinor: 395 }, { upToGrams: 2000, priceMinor: 695 }] }), '£3.95 to £6.95 by weight'); });
test('validates rates with plain reasons', () => {
  assert.equal(validateRate({ label: 'Standard', priceMinor: 495 }), null); assert.match(validateRate({ label: '', priceMinor: 1 })!, /name/); assert.match(validateRate({ label: 'a', priceMinor: -1 })!, /zero or more/);
  assert.match(validateRate({ label: 'a', priceMinor: 1, when: { minOrderMinor: 5000, maxOrderMinor: 1000 } })!, /smallest order/);
  assert.match(validateRate({ label: 'a', priceMinor: 0, bands: [{ upToGrams: 500, priceMinor: 1 }, { upToGrams: 400, priceMinor: 2 }] })!, /go up/); assert.match(validateRate({ label: 'a', priceMinor: 0, bands: [], })!, /at least|between 1/); assert.match(validateRate({ label: 'a', priceMinor: 0, freeOverMinor: 5000, bands: [{ upToGrams: 1, priceMinor: 1 }] })!, /flat prices/);
});
test('splits regions into countries and postcode areas', () => {
  assert.deepEqual(splitRegions('United Kingdom, Ireland', countries), { codes: ['GB', 'IE'], postcodes: '', unknown: [] });
  const h = splitRegions('IV, KW, PA20–80, SW1A', countries); assert.deepEqual(h.codes, ['GB']); assert.equal(h.postcodes, 'IV,KW,PA20-80,SW1A');
  assert.deepEqual(splitRegions('IM', countries).codes, ['IM'], 'a name that is a country is a country'); assert.deepEqual(splitRegions('France, Narnia', countries).unknown, ['France', 'Narnia']);
});
test('a catch-all zone excludes the postcode areas other zones serve', () => {
  const ex = exclusionsFor([{ name: 'UK', postcodes: '' }, { name: 'Highlands', postcodes: 'IV,KW' }, { name: 'Islands', postcodes: 'HS,ZE' }, { name: 'Ireland', postcodes: '' }]);
  assert.equal(ex.get('UK'), 'IV,KW,HS,ZE'); assert.equal(ex.get('Highlands'), ''); assert.equal(ex.get('Islands'), '');
});
test('weight bands round-trip through the engine format', () => { const b = [{ upToGrams: 500, priceMinor: 395 }, { upToGrams: 2000, priceMinor: 695 }]; assert.deepEqual(bandsFromJson(bandsJson(b)), b); assert.equal(bandsFromJson('nope'), undefined); });
import { offeredRates } from './delivery.ts';
test('offeredRates applies limits, free-over and weight bands like the engine', () => {
  const rates = [{ label: 'Standard', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Light', priceMinor: 295, when: { maxWeightGrams: 1000 } }, { label: 'By weight', priceMinor: 0, bands: [{ upToGrams: 1000, priceMinor: 395 }, { upToGrams: 5000, priceMinor: 795 }], when: { minOrderMinor: 1000 } }];
  assert.deepEqual(offeredRates(rates, { basketMinor: 400, weightGrams: 300 }), [{ label: 'Standard', priceMinor: 495 }, { label: 'Light', priceMinor: 295 }]);
  assert.deepEqual(offeredRates(rates, { basketMinor: 3000, weightGrams: 3000 }), [{ label: 'Standard', priceMinor: 495 }, { label: 'By weight', priceMinor: 795 }]);
  assert.deepEqual(offeredRates(rates, { basketMinor: 6000, weightGrams: 9000 }), [{ label: 'Standard', priceMinor: 0 }, { label: 'By weight', priceMinor: 795 }], 'heavier than the last band uses the last band');
});
