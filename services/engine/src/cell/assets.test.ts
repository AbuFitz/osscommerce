// Media goes to S3-compatible storage under a store-scoped key, with type and size limits. Runs against a local S3 server (s3rver) on 127.0.0.1:9100; skipped when it is not running.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { parse } from 'graphql';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { assetPlugin, storeOfKey, StoreScopedNaming, ASSET_LIMITS, readAssetEnv } from './assets.ts';

const ENV = { endpoint: 'http://127.0.0.1:9100', bucket: 'osc-media', accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER', publicUrl: 'http://127.0.0.1:9100/osc-media' };
let up = false;
const dir = path.join(__dirname, '.tmp-assets'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const { server, adminClient } = createTestEnvironment(mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'ops', password: 'long-random-pass' } }, assetOptions: ASSET_LIMITS, plugins: [assetPlugin(ENV)] }));
const s3 = new S3Client({ endpoint: ENV.endpoint, region: 'auto', forcePathStyle: true, credentials: { accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER' } });
const keys = async () => ((await s3.send(new ListObjectsV2Command({ Bucket: ENV.bucket }))).Contents ?? []).map(o => o.Key!);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
before(async () => { up = await fetch(ENV.endpoint + '/osc-media').then(r => r.status < 500, () => false); if (!up) return; await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv'), customerCount: 0 }); await adminClient.asSuperAdmin(); });
after(async () => { if (up) await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });
const T = { skip: process.env.S3_TEST === '1' ? false : 'set S3_TEST=1 with a local S3 server on :9100 (npx s3rver -d ./data -p 9100 --configure-bucket osc-media)' };

test('keys: store-scoped, unguessable, never trust the client path', () => {
  const n = new StoreScopedNaming(); const k = n.generateSourceFileName({ channelId: 7 } as any, '../../etc/Passwd Photo.PNG'); assert.match(k, /^store-7\/source\/[0-9a-f]{12}\/passwd-photo\.png$/i); assert.equal(storeOfKey(k), '7');
  assert.equal(n.generatePreviewFileName({ channelId: 7 } as any, k), k.replace('/source/', '/preview/').replace(/\.png$/i, '__preview.png')); assert.equal(storeOfKey('somebody/else.png'), null);
});
test('env: half-configured storage is refused', () => { assert.equal(readAssetEnv({}), null); assert.throws(() => readAssetEnv({ ASSET_S3_BUCKET: 'x' }), /half-configured/); });
test('upload: an image lands in the bucket under the store prefix, with a preview, and the record points at it', T, async () => {
  const r = await adminClient.fileUploadMutation({ mutation: parse(`mutation Up($f:[CreateAssetInput!]!){ createAssets(input:$f){ __typename ... on Asset { id source preview mimeType } ... on ErrorResult { message } } }`), filePaths: (() => { const p = path.join(dir, 'pixel.png'); fs.writeFileSync(p, PNG); return [p]; })(), mapVariables: (fps: unknown[]) => ({ f: fps.map(() => ({ file: null })) }) } as any);
  const a = r.createAssets[0]; assert.equal(a.__typename, 'Asset', JSON.stringify(a)); assert.equal(a.mimeType, 'image/png'); assert.match(a.source, /store-1\/source\/[0-9a-f]{12}\/pixel\.png$/);
  const ks = await keys(); assert.ok(ks.some(k => /^store-1\/source\//.test(k)), ks.join(',')); assert.ok(ks.some(k => /^store-1\/preview\//.test(k)), 'preview generated'); assert.ok(ks.every(k => storeOfKey(k) === '1'));
  const pub = await fetch(a.source); assert.equal(pub.status, 200); assert.equal(Buffer.from(await pub.arrayBuffer()).equals(PNG), true, 'storefront delivery returns the stored bytes');
});
test('limits: a non-image is refused and nothing is stored', T, async () => {
  const before = (await keys()).length; const p = path.join(dir, 'notes.txt'); fs.writeFileSync(p, 'hello');
  const r: any = await adminClient.fileUploadMutation({ mutation: parse(`mutation Up($f:[CreateAssetInput!]!){ createAssets(input:$f){ __typename ... on MimeTypeError { message } } }`), filePaths: [p], mapVariables: (fps: unknown[]) => ({ f: fps.map(() => ({ file: null })) }) } as any);
  assert.equal(r.createAssets[0].__typename, 'MimeTypeError'); assert.equal((await keys()).length, before);
});
