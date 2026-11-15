import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniff, stripMetadata, createService, MemSessions, HandoffError, MAX_FILE_BYTES, TTL_SECONDS, type Caller } from './index.ts';

const GPS = 'GPS-51.5072N-0.1276W', enc = (s: string) => Array.from(Buffer.from(s));
const jpeg = (extra = true) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
  ...(extra ? [0xff, 0xe1, 0, 2 + 6 + GPS.length, ...enc('Exif\0\0'), ...enc(GPS), 0xff, 0xfe, 0, 2 + 4, ...enc('hide')] : []),
  0xff, 0xdb, 0, 4, 1, 2, 0xff, 0xda, 0, 4, 0, 0, 1, 2, 3, 0xff, 0xd9]);
const chunk = (t: string, d: number[]) => [0, 0, 0, d.length, ...enc(t), ...d, 0, 0, 0, 0];
const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', Array(13).fill(1)), ...chunk('eXIf', enc(GPS)), ...chunk('tEXt', enc('Comment\0home')), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])]);
const le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
const webp = () => { const vp8 = [...enc('VP8 '), ...le(4), 1, 2, 3, 4], exif = [...enc('EXIF'), ...le(GPS.length + (GPS.length & 1)), ...enc(GPS), ...(GPS.length & 1 ? [0] : [])]; const body = [...enc('WEBP'), ...enc('VP8X'), ...le(10), 0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...vp8, ...exif]; return Uint8Array.from([...enc('RIFF'), ...le(body.length), ...body]); };
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(s);

test('sniff: by content, not name; random bytes and HTML are rejected', () => {
  assert.equal(sniff(jpeg()), 'jpeg'); assert.equal(sniff(png()), 'png'); assert.equal(sniff(webp()), 'webp');
  assert.equal(sniff(Buffer.from('<html><script>alert(1)</script>')), null); assert.equal(sniff(Buffer.from('GIF89a......')), null); assert.equal(sniff(new Uint8Array(3)), null);
});
test('metadata: GPS and comments are removed from JPEG, PNG and WebP, and the files stay valid', () => {
  const j = stripMetadata(jpeg(), 'jpeg'); assert.ok(!has(j, GPS) && !has(j, 'hide')); assert.deepEqual([...j.slice(0, 2)], [0xff, 0xd8]); assert.deepEqual([...j.slice(-2)], [0xff, 0xd9]); assert.ok(has(j, 'JFIF'), 'JFIF header kept'); assert.equal(sniff(j), 'jpeg');
  const p = stripMetadata(png(), 'png'); assert.ok(!has(p, GPS) && !has(p, 'home')); assert.ok(has(p, 'IHDR') && has(p, 'IDAT') && has(p, 'IEND')); assert.equal(sniff(p), 'png');
  const w = stripMetadata(webp(), 'webp'); assert.ok(!has(w, GPS) && !has(w, 'EXIF')); assert.equal(sniff(w), 'webp'); assert.equal((w[4] | (w[5] << 8) | (w[6] << 16) | (w[7] << 24)), w.length - 8, 'RIFF size fixed'); assert.equal(w[20] & 0x08, 0, 'Exif flag cleared');
});
test('metadata: a corrupt image is refused, not passed through', () => { assert.throws(() => stripMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2]), 'jpeg')); });

function world() {
  const store = new MemSessions(); const stored: { storeId: string; productId: string; bytes: Uint8Array; type: string }[] = []; let t = 1_000_000, n = 0;
  const svc = createService({ store, now: () => t, random: (k: number) => Buffer.alloc(k, ++n), photos: { put: async (storeId, productId, _f, bytes, type) => { stored.push({ storeId, productId, bytes, type }); } } });
  return { svc, store, stored, tick: (s: number) => { t += s * 1000; } };
}
const A: Caller = { storeId: 'store_a', userId: 'u1', role: 'owner' }, B: Caller = { storeId: 'store_b', userId: 'u9', role: 'owner' };
const target = { kind: 'product_photos' as const, productId: 'p1', label: 'Speckled mug' };

test('flow: create -> phone opens -> uploads clean photos -> desktop sees them -> closed', async () => {
  const w = world(); const h = await w.svc.create(A, target); assert.equal((await w.svc.status(A, h.id)).state, 'waiting');
  const o = await w.svc.open(h.token, 'phone-1'); assert.equal(o.label, 'Speckled mug'); assert.equal((await w.svc.status(A, h.id)).state, 'connected');
  const r = await w.svc.upload(h.token, 'phone-1', jpeg()); assert.equal(r.duplicate, false); assert.ok(!has(w.stored[0].bytes, GPS), 'stored copy has no GPS'); assert.equal(w.stored[0].productId, 'p1'); assert.equal(w.stored[0].type, 'image/jpeg');
  assert.equal((await w.svc.upload(h.token, 'phone-1', jpeg())).duplicate, true, 'same photo twice is stored once'); assert.equal(w.stored.length, 1);
  assert.equal((await w.svc.status(A, h.id)).files.length, 1);
  assert.equal((await w.svc.close(A, h.id, 'completed')).state, 'completed'); await assert.rejects(w.svc.upload(h.token, 'phone-1', png()), (e: any) => e.code === 'expired');
});
test('device binding: a second phone, a forwarded link or a wrong device cannot upload', async () => {
  const w = world(); const h = await w.svc.create(A, target); await w.svc.open(h.token, 'phone-1');
  await assert.rejects(w.svc.open(h.token, 'phone-2'), (e: any) => e.code === 'device'); await assert.rejects(w.svc.upload(h.token, 'phone-2', jpeg()), (e: any) => e.code === 'device'); assert.equal(w.stored.length, 0);
  const h2 = await w.svc.create(A, target); await assert.rejects(w.svc.upload(h2.token, 'anyone', jpeg()), (e: any) => e.code === 'device', 'must open before uploading');
});
test('token: guessed, truncated, wrong-secret and malformed tokens are all "not valid"', async () => {
  const w = world(); const h = await w.svc.create(A, target); const [id] = h.token.split('.');
  for (const bad of ['', 'x', `${id}.`, `${id}.${'a'.repeat(43)}`, `nope.${h.token.split('.')[1]}`, `${id}.${h.token.split('.')[1]}x`]) await assert.rejects(w.svc.open(bad, 'p'), (e: any) => e.code === 'not_found', bad);
  assert.ok(!JSON.stringify([...w.store.m.values()]).includes(h.token.split('.')[1]), 'the secret is never stored');
});
test('expiry: the link stops working after the time limit, for opening and uploading', async () => {
  const w = world(); const h = await w.svc.create(A, target); await w.svc.open(h.token, 'p'); w.tick(TTL_SECONDS + 1);
  await assert.rejects(w.svc.upload(h.token, 'p', jpeg()), (e: any) => e.code === 'expired'); assert.equal((await w.svc.status(A, h.id)).state, 'expired');
});
test('uploads are validated: type, size, count, corruption', async () => {
  const w = world(); const h = await w.svc.create(A, target, 2); await w.svc.open(h.token, 'p');
  await assert.rejects(w.svc.upload(h.token, 'p', Buffer.from('<script>alert(1)</script>')), (e: any) => e.code === 'type');
  await assert.rejects(w.svc.upload(h.token, 'p', Uint8Array.from([0xff, 0xd8, 0xff, ...new Uint8Array(MAX_FILE_BYTES)])), (e: any) => e.code === 'size');
  await assert.rejects(w.svc.upload(h.token, 'p', Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), (e: any) => e.code === 'invalid');
  await w.svc.upload(h.token, 'p', jpeg()); await w.svc.upload(h.token, 'p', png()); await assert.rejects(w.svc.upload(h.token, 'p', webp()), (e: any) => e.code === 'limit');
});
test('isolation: another store or user cannot see, close or poll a handoff; support cannot create one; active links are limited', async () => {
  const w = world(); const h = await w.svc.create(A, target);
  await assert.rejects(w.svc.status(B, h.id), (e: any) => e.code === 'not_found'); await assert.rejects(w.svc.close(B, h.id, 'cancelled'), (e: any) => e.code === 'not_found');
  await assert.rejects(w.svc.status({ ...A, userId: 'u2' }, h.id), (e: any) => e.code === 'not_found', 'same store, different user');
  await assert.rejects(w.svc.create({ ...A, role: 'support' }, target), (e: any) => e.code === 'forbidden');
  await w.svc.create(A, target); await w.svc.create(A, target); await assert.rejects(w.svc.create(A, target), (e: any) => e.code === 'limit'); await w.svc.close(A, h.id, 'cancelled'); assert.ok(await w.svc.create(A, target));
});
