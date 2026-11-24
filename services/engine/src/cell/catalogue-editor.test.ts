// The portal's product editor against a real Vendure: create with details, edit, upload real photos over multipart, reorder, remove, delete.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs'; import zlib from 'node:zlib';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { parse } from 'graphql';
import { CatalogueFieldsPlugin } from './catalogue-fields.ts';
import { httpExec, engineLogin } from '../../../../apps/portal/src/lib/engine/exec.ts';
import { ensureTaxCategories } from '../../../../apps/portal/src/lib/engine/catalogue.ts';
import * as A from '../../../../apps/portal/src/lib/engine/adapter.ts';

const dir = path.join(__dirname, '.tmp-editor'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const uploads = path.join(dir, 'assets');
const config = mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'owner@example.com', password: 'long-random-pass' } }, customFields: { ProductVariant: [{ name: 'weightGrams', type: 'int', defaultValue: 0, public: true }] }, plugins: [CatalogueFieldsPlugin, AssetServerPlugin.init({ route: 'assets', assetUploadDir: uploads })] });
const { server, adminClient } = createTestEnvironment(config); const g = (s: string) => parse(s);
const URL = `http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`;
let x: ReturnType<typeof httpExec>;

function png(seed: number): Uint8Array {
  const w = 16, h = 16; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const o = y * (w * 3 + 1) + 1 + i * 3; raw[o] = (seed * 60 + i * 9) & 255; raw[o + 1] = y * 12; raw[o + 2] = 120; }
  const t: number[] = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

before(async () => {
  await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [{ name: 'Standard', price: 500 }], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv') });
  await adminClient.asSuperAdmin(); await ensureTaxCategories((q, v) => adminClient.query(g(q), v));
  const login = await engineLogin({ url: URL }, 'owner@example.com', 'long-random-pass'); assert.ok(login); x = httpExec({ url: URL }, login!.token);
});
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });
let id = '';

test('create keeps description, SEO, compare-at price, barcode, weight and VAT class', async () => {
  const r = await A.addProduct(x, { title: 'Butter dish', priceMinor: 2400, status: 'draft', onHand: 7, sku: 'BTR-1', description: 'A lidded dish.', compareAtMinor: 3000, barcode: '5012345678900', weightGrams: 450, taxClass: 'reduced', seoTitle: 'Butter dish | Kiln', seoDescription: 'Hand thrown.' });
  assert.equal(r.ok, true, r.message); assert.ok(r.id); id = r.id!;
  const p = (await A.getProduct(x, id))!;
  assert.equal(p.description, 'A lidded dish.'); assert.equal(p.seoTitle, 'Butter dish | Kiln'); assert.equal(p.seoDescription, 'Hand thrown.'); assert.equal(p.status, 'draft'); assert.equal(p.handle, 'butter-dish');
  const v = p.variantList[0]; assert.equal(v.compareAtMinor, 3000); assert.equal(v.barcode, '5012345678900'); assert.equal(v.weightGrams, 450); assert.equal(v.taxClass, 'reduced'); assert.equal(v.onHand, 7);
});
test('create refuses a compare-at price that is not higher than the price', async () => {
  const r = await A.addProduct(x, { title: 'Bad sale', priceMinor: 2400, status: 'draft', onHand: 1, compareAtMinor: 2400 }); assert.equal(r.ok, false); assert.match(r.message, /higher/);
});
test('edit changes name, description, address, SEO and visibility', async () => {
  const r = await A.updateProduct(x, id, { title: 'Butter dish, large', description: 'Bigger.', handle: 'big-butter-dish', seoTitle: '', seoDescription: 'New text.', status: 'published' }); assert.equal(r.ok, true, r.message);
  const p = (await A.getProduct(x, id))!; assert.equal(p.title, 'Butter dish, large'); assert.equal(p.handle, 'big-butter-dish'); assert.equal(p.status, 'published'); assert.equal(p.seoTitle, ''); assert.equal(p.seoDescription, 'New text.');
});
test('edit refuses an empty name', async () => { assert.equal((await A.updateProduct(x, id, { title: '  ', description: '', handle: '', seoTitle: '', seoDescription: '', status: 'draft' })).ok, false); });
test('photos upload over multipart, the first becomes the main photo, and non-photos are refused before upload', async () => {
  const r = await A.uploadProductImages(x, id, [{ name: 'a.png', type: 'image/png', bytes: png(1) }, { name: 'b.png', type: 'image/png', bytes: png(2) }, { name: 'notes.txt', type: 'text/plain', bytes: new TextEncoder().encode('hello') }]);
  assert.equal(r.ok, true, r.message); assert.match(r.message, /2 photos added/); assert.match(r.message, /notes\.txt is not a JPEG/);
  const p = (await A.getProduct(x, id))!; assert.equal(p.images.length, 2); assert.ok(p.imageUrl && p.imageUrl === p.images[0].url, 'main photo is the first');
});
test('reorder makes another photo main; removing one deletes it from the product', async () => {
  let p = (await A.getProduct(x, id))!; const [a, b] = p.images.map(i => i.id);
  assert.equal((await A.setProductImages(x, id, [b, a])).ok, true); p = (await A.getProduct(x, id))!; assert.deepEqual(p.images.map(i => i.id), [b, a]); assert.equal(p.imageUrl, p.images[0].url);
  assert.equal((await A.setProductImages(x, id, [b])).ok, true); p = (await A.getProduct(x, id))!; assert.equal(p.images.length, 1);
  assert.equal((await A.setProductImages(x, id, [b, b])).ok, false, 'a photo cannot be listed twice');
});
test('an empty file and an oversized file are refused', async () => {
  assert.equal((await A.uploadProductImages(x, id, [{ name: 'e.png', type: 'image/png', bytes: new Uint8Array(0) }])).ok, false);
  assert.equal((await A.uploadProductImages(x, id, [{ name: 'big.png', type: 'image/png', bytes: new Uint8Array(11 * 1024 * 1024) }])).ok, false);
});
test('delete removes the product', async () => { assert.equal((await A.deleteProduct(x, id)).ok, true); assert.equal(await A.getProduct(x, id), null); });
