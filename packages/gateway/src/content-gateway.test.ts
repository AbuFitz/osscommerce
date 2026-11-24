import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createContentGateway } from './content-gateway.ts';

const secret = 'a'.repeat(43); const hash = createHash('sha256').update(secret).digest('hex');
const world = () => {
  const reads: string[] = []; const audit: any[] = [];
  const handle = createContentGateway({
    registry: { resolve: async h => h.toString('hex') === hash ? { storefrontId: 'sf_a', storeId: 'store_a', env: 'production', liveOrders: true, cellId: 'cell_a', configVersion: 1 } : null },
    content: { get: async (sf, entry) => { reads.push(`${sf}:${entry}`); return entry === 'legal/privacy' ? { entry, revision: 3, schemaVersion: 0, body: { body: 'Privacy text' }, publishedAt: '2026-11-24T10:00:00.000Z' } : null; } },
    rateLimit: { take: () => true }, audit: { record: e => audit.push(e) },
  });
  const call = (entry: string, s = secret, sf = 'sf_a', extra: Record<string,string> = {}) => handle({ entry, headers: { authorization: `Bearer ${s}`, 'oss-storefront': sf, ...extra } });
  return { call, reads, audit };
};

test('published content is credential-bound, cacheable and supports ETags', async () => {
  const w = world(); const first = await w.call('legal/privacy'); assert.equal(first.status, 200); assert.equal(JSON.parse(first.body).body.body, 'Privacy text'); assert.match(first.headers['cache-control'], /s-maxage=60/);
  const cached = await w.call('legal/privacy', secret, 'sf_a', { 'if-none-match': first.headers.etag }); assert.equal(cached.status, 304); assert.equal(cached.body, '');
  assert.deepEqual(w.reads, ['sf_a:legal/privacy', 'sf_a:legal/privacy']); assert.ok(w.audit.every(e => !JSON.stringify(e).includes(secret)));
});

test('content cannot cross storefronts and invalid or missing entries fail closed', async () => {
  const w = world(); assert.equal((await w.call('legal/privacy', secret, 'sf_b')).status, 403); assert.equal((await w.call('../secret')).status, 400); assert.equal((await w.call('legal/terms')).status, 404); assert.equal((await w.call('legal/privacy', 'x'.repeat(43))).status, 401); assert.equal(w.reads.length, 1);
});
