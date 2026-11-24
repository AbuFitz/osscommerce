import assert from 'node:assert/strict';
import test from 'node:test';
import { listShippingTax, saveShippingZone } from './engine/adapter.ts';

const op = (code: string, args: Record<string, string> = {}) => ({ code, args: Object.entries(args).map(([name, value]) => ({ name, value })) });

test('live shipping groups channel methods into merchant delivery zones', async () => {
  const exec = async () => ({
    activeChannel: { pricesIncludeTax: true },
    shippingMethods: { items: [
      { id: '1', code: 'a', name: 'Standard', checker: op('oss-delivery-zone', { countries: 'GB,IE', zoneName: 'Home', regionsLabel: 'United Kingdom, Ireland' }), calculator: op('oss-flat-rate-free-over', { rate: '495', freeOver: '5000' }) },
      { id: '2', code: 'b', name: 'Express', checker: op('oss-delivery-zone', { countries: 'GB,IE', zoneName: 'Home', regionsLabel: 'United Kingdom, Ireland' }), calculator: op('oss-flat-rate-free-over', { rate: '995', freeOver: '0' }) },
      { id: 'legacy', code: 'legacy', name: 'Legacy', checker: op('default-shipping-eligibility-checker'), calculator: op('default-shipping-calculator', { rate: '100' }) },
    ] },
  });
  assert.deepEqual(await listShippingTax(exec as any), { pricesIncludeTax: true, zones: [{ name: 'Home', regions: 'United Kingdom, Ireland', rates: [{ label: 'Standard', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Express', priceMinor: 995, freeOverMinor: undefined }] }] });
});

test('stores provisioned before managed zones expose their existing shipping method', async () => {
  const exec = async () => ({ activeChannel: { pricesIncludeTax: true }, shippingMethods: { items: [
    { id: 'old', code: 'ship-store-a', name: 'Standard delivery', checker: op('default-shipping-eligibility-checker', { orderMinimum: '0' }), calculator: op('default-shipping-calculator', { rate: '495' }) },
  ] } });
  assert.deepEqual((await listShippingTax(exec as any)).zones, [{ name: 'United Kingdom', regions: 'United Kingdom', rates: [{ label: 'Standard delivery', priceMinor: 495, freeOverMinor: undefined }] }]);
});

test('saving a zone resolves enabled countries and only sends allowlisted shipping operations', async () => {
  const calls: { query: string; input?: any }[] = [];
  const exec = async (query: string, variables?: any) => {
    if (query.includes('countries(')) return { activeChannel: { pricesIncludeTax: true }, countries: { items: [{ code: 'GB', name: 'United Kingdom', enabled: true }, { code: 'IE', name: 'Ireland', enabled: true }] } };
    if (query.includes('query{ shippingMethods')) return { shippingMethods: { items: [] } };
    calls.push({ query, input: variables?.i }); return { createShippingMethod: { id: '1' } };
  };
  const result = await saveShippingZone(exec as any, { name: 'Home', regions: 'UK, IE', rates: [{ label: 'Standard', priceMinor: 495, freeOverMinor: 5000 }] });
  assert.deepEqual(result, { ok: true, message: 'Home delivery options are live.' });
  assert.equal(calls.length, 1); assert.match(calls[0].query, /createShippingMethod/);
  assert.equal(calls[0].input.checker.code, 'oss-delivery-zone');
  assert.equal(calls[0].input.checker.arguments.find((a: any) => a.name === 'countries').value, 'GB,IE');
  assert.equal(calls[0].input.calculator.arguments.find((a: any) => a.name === 'rate').value, '495');
  assert.equal((await saveShippingZone(exec as any, { name: 'X', regions: 'Atlantis', rates: [{ label: 'Standard', priceMinor: 1 }] })).ok, false);
});
