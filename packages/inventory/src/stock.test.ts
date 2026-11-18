import test from 'node:test';
import assert from 'node:assert/strict';
import { available, availability, restock, sell, totalUnits, validate, type Group, type State } from './stock.ts';

const formats = [{ id: 'single', units: 1 }, { id: 'pack6', units: 6 }, { id: 'case24', units: 24 }];
const sealed: Group = { id: 'g', formats, policy: { mode: 'sealed', autoBreak: true, lowAtUnits: 3 } };
const pooled: Group = { id: 'g', formats, policy: { mode: 'pooled', autoBreak: true, lowAtUnits: 3 } };
const st = (loose: number, s: Record<string, number> = {}): State => ({ loose, sealed: s });

test('sealed: singles sell from loose stock first, no pack is opened', () => {
  const r = sell(sealed, st(5, { pack6: 2 }), 'single', 3);
  assert.equal(r.ok, true); assert.deepEqual(r.state, st(2, { pack6: 2 })); assert.equal(r.events.some(e => e.type === 'stock.pack_broken'), false);
});
test('sealed: when singles run out, a pack is broken automatically and the merchant is told', () => {
  const r = sell(sealed, st(1, { pack6: 2 }), 'single', 3);
  assert.equal(r.ok, true); assert.deepEqual(r.state, st(4, { pack6: 1 }));
  assert.deepEqual(r.events.find(e => e.type === 'stock.pack_broken'), { type: 'stock.pack_broken', formatId: 'pack6', packs: 1, unitsReleased: 6 });
});
test('sealed: opens the smallest pack first and as many as needed', () => {
  const r = sell(sealed, st(0, { pack6: 1, case24: 1 }), 'single', 10);
  assert.equal(r.ok, true); assert.deepEqual(r.state, { loose: 20, sealed: { pack6: 0, case24: 0 } });
  assert.equal(totalUnits(sealed, r.state), 20);
});
test('sealed: pack availability is the sealed count, and singles show everything that could be opened', () => {
  assert.deepEqual(availability(sealed, st(2, { pack6: 3 })), { single: 20, pack6: 3, case24: 0 });
});
test('sealed with autoBreak off: singles never open a pack', () => {
  const g: Group = { ...sealed, policy: { ...sealed.policy, autoBreak: false } };
  assert.equal(available(g, st(2, { pack6: 3 }), 'single'), 2);
  assert.equal(sell(g, st(2, { pack6: 3 }), 'single', 3).reason, 'insufficient_stock');
});
test('sealed: selling a pack reduces sealed stock only', () => {
  const r = sell(sealed, st(4, { pack6: 2 }), 'pack6', 2); assert.deepEqual(r.state, st(4, { pack6: 0 }));
});
test('pooled: a pack is available while there are enough singles, and sells as that many units', () => {
  assert.deepEqual(availability(pooled, st(30)), { single: 30, pack6: 5, case24: 1 });
  assert.equal(sell(pooled, st(30), 'pack6', 2).state.loose, 18);
  assert.equal(sell(pooled, st(5), 'pack6', 1).reason, 'insufficient_stock');
});
test('pooled: a sale of singles shrinks pack availability with no manual step', () => {
  const r = sell(pooled, st(12), 'single', 7); assert.equal(available(pooled, r.state, 'pack6'), 0);
});
test('overselling is refused and the state is untouched', () => {
  const s = st(1, { pack6: 1 }); const r = sell(sealed, s, 'single', 8); assert.equal(r.ok, false); assert.equal(r.state, s);
});
test('bad input is refused', () => {
  assert.equal(sell(sealed, st(5), 'nope', 1).reason, 'unknown_format'); assert.equal(sell(sealed, st(5), 'single', 0).reason, 'bad_quantity'); assert.equal(sell(sealed, st(5), 'single', 1.5).reason, 'bad_quantity');
});
test('low and out events fire once as stock crosses the line', () => {
  const low = sell(sealed, st(5), 'single', 3); assert.deepEqual(low.events, [{ type: 'stock.low', unitsLeft: 2 }]);
  assert.deepEqual(sell(sealed, st(2), 'single', 2).events, [{ type: 'stock.out' }]);
  assert.deepEqual(sell(sealed, st(9), 'single', 1).events, []);
});
test('restock puts packs in sealed and singles in loose; pooled always counts singles', () => {
  assert.deepEqual(restock(sealed, st(1), 'pack6', 2), st(1, { pack6: 2 })); assert.equal(restock(pooled, st(1), 'pack6', 2).loose, 13);
});
test('configuration checks', () => {
  assert.deepEqual(validate(sealed), []);
  assert.ok(validate({ ...sealed, formats: [{ id: 'pack6', units: 6 }] }).length > 0);
  assert.ok(validate({ ...sealed, formats: [{ id: 'a', units: 1 }, { id: 'b', units: 1 }] }).length > 0);
});
