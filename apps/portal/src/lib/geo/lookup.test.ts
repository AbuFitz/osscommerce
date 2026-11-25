import { test } from 'node:test'; import assert from 'node:assert/strict';
import { locate, countryCode } from './lookup';
test('finds towns, in any case or with accents', () => {
  const b = locate('bristol', 'GB'); assert.equal(b?.precision, 'town'); assert.ok(Math.abs(b!.lat - 51.45) < 0.3 && Math.abs(b!.lng + 2.58) < 0.3); assert.equal(b?.place, 'Bristol, United Kingdom');
  assert.equal(locate('Zürich', 'CH')?.precision, 'town'); assert.equal(locate('MANCHESTER', 'uk')?.precision, 'town');
});
test('unknown town falls back to the country, unknown country to nothing', () => {
  const x = locate('Nowhereville', 'FR'); assert.equal(x?.precision, 'country'); assert.equal(x?.place, 'France');
  assert.equal(locate('Bristol', 'ZZ'), null); assert.equal(locate('Bristol', ''), null);
});
test('country names and codes', () => { assert.equal(countryCode('United Kingdom'), 'GB'); assert.equal(countryCode('Ireland'), 'IE'); assert.equal(countryCode('United States'), 'US'); assert.equal(countryCode('xx'), undefined); });
test('small British towns are covered', () => { for (const t of ['Stroud', 'Falmouth', 'Ludlow', 'Hexham']) assert.equal(locate(t, 'GB')?.precision, 'town', t); });
