import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, ConfigError, tag, parseTag, sign, verify, handleRevalidation, createClient, checkCompatibility, OssApiError, validateEntry, diffManifests, Manifest } from './index.ts';

const env = { OSS_COMMERCE_API_URL: 'https://api.example.com', OSS_STORE_ID: 'store_a', OSS_STOREFRONT_ID: 'sf_a', OSS_ENV: 'staging', OSS_STOREFRONT_SERVER_SECRET: 's'.repeat(43), OSS_REVALIDATION_SECRET: 'r'.repeat(43), OSS_SITE_URL: 'https://a.example.com' };

test('config: valid, frozen, preview/staging cannot take live orders', () => { const c = loadConfig(env); assert.equal(c.liveOrders, false); assert.throws(() => { (c as any).storeId = 'x'; }); });
test('config: no default channel/store — missing values refuse to boot', () => { for (const k of Object.keys(env)) assert.throws(() => loadConfig({ ...env, [k]: undefined }), ConfigError); });
test('config: secrets must be distinct, https outside dev, no public secrets, production needs own domain', () => {
  assert.throws(() => loadConfig({ ...env, OSS_REVALIDATION_SECRET: env.OSS_STOREFRONT_SERVER_SECRET }), /differ/);
  assert.throws(() => loadConfig({ ...env, OSS_COMMERCE_API_URL: 'http://api.example.com' }), /https/);
  assert.throws(() => loadConfig({ ...env, NEXT_PUBLIC_OSS_SECRET: 'x' }), /public/);
  assert.throws(() => loadConfig({ ...env, OSS_ENV: 'production', OSS_SITE_URL: 'https://x.vercel.app' }), /own domain/);
  assert.equal(loadConfig({ ...env, OSS_ENV: 'production' }).liveOrders, true);
});

test('tags: tenant-qualified, unsafe segments rejected, round trip', () => {
  assert.equal(tag('store_a', 'product', 'p1'), 'store_a:product:p1'); assert.throws(() => tag('a:b', 'product')); assert.throws(() => tag('a', 'product', '../x'));
  assert.deepEqual(parseTag('store_a:product:p1'), { storeId: 'store_a', kind: 'product', id: 'p1' }); assert.equal(parseTag('store_a:cart:1'), null); assert.equal(parseTag('a:product:b:c'), null);
});

test('signing: valid, tampered, wrong secret, stale, malformed', () => {
  const body = '{"a":1}', now = 1_700_000_000, h = sign('k'.repeat(40), body, now);
  assert.equal(verify('k'.repeat(40), body, h, now + 10).ok, true);
  assert.deepEqual(verify('k'.repeat(40), body + ' ', h, now), { ok: false, reason: 'bad_signature' });
  assert.deepEqual(verify('j'.repeat(40), body, h, now), { ok: false, reason: 'bad_signature' });
  assert.deepEqual(verify('k'.repeat(40), body, h, now + 301), { ok: false, reason: 'stale' });
  assert.deepEqual(verify('k'.repeat(40), body, 'nope', now), { ok: false, reason: 'malformed' });
});

function revDeps() {
  const seen = new Set<string>(); let seq = 0; const hit: string[] = [];
  return { hit, d: { secret: 'k'.repeat(40), storeId: 'store_a', storefrontId: 'sf_a', revalidate: (t: string) => hit.push(t), seen: { markIfNew: (id: string) => !seen.has(id) && !!seen.add(id), lastSequence: () => seq, setSequence: (n: number) => { seq = Math.max(seq, n); } } } };
}
const ev = (o: any = {}) => JSON.stringify({ eventId: 'evt-00000001', storeId: 'store_a', storefrontId: 'sf_a', sequence: 1, tags: ['store_a:product:p1'], ...o });
test('revalidation: signed event refreshes only this store tags; another store tag is rejected', async () => {
  const { d, hit } = revDeps(); const b = ev({ tags: ['store_a:product:p1', 'store_b:product:p1', 'bogus'] });
  const r = await handleRevalidation(d, b, sign(d.secret, b)); assert.equal(r.status, 207); assert.deepEqual(hit, ['store_a:product:p1']);
});
test('revalidation: unsigned/forged 401, other storefront 403, duplicate ignored, late older event ignored', async () => {
  const { d, hit } = revDeps(); const b = ev({ sequence: 5 });
  assert.equal((await handleRevalidation(d, b, null)).status, 401); assert.equal((await handleRevalidation(d, b, sign('x'.repeat(40), b))).status, 401);
  const other = ev({ storefrontId: 'sf_other', eventId: 'evt-00000002' }); assert.equal((await handleRevalidation(d, other, sign(d.secret, other))).status, 403);
  assert.equal((await handleRevalidation(d, b, sign(d.secret, b))).status, 200); assert.equal((await handleRevalidation(d, b, sign(d.secret, b))).body.duplicate, true);
  const old = ev({ sequence: 2, eventId: 'evt-00000003' }); assert.equal((await handleRevalidation(d, old, sign(d.secret, old))).body.stale, true); assert.equal(hit.length, 1);
});

const cfg = loadConfig(env);
const res = (status: number, body: any = { data: { ok: 1 } }, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: h });
test('client: sends credential + storefront id, no channel header, returns session', async () => {
  let seen: any; const c = createClient(cfg, { fetch: (async (_u: any, i: any) => { seen = i; return res(200, { data: { a: 1 } }, { 'oss-session': 'tok', 'oss-request-id': 'r1' }); }) as any });
  const r = await c.query<{ a: number }>('Q', 'query { a }'); assert.equal(r.session, 'tok');
  assert.equal(seen.headers.authorization, `Bearer ${cfg.serverSecret}`); assert.equal(seen.headers['oss-storefront'], 'sf_a'); assert.ok(!('vendure-token' in seen.headers));
});
test('client: reads retry on 503 then succeed; mutations without an idempotency key never retry', async () => {
  let n = 0; const mk = () => createClient(cfg, { sleep: async () => {}, fetch: (async () => (++n === 1 ? res(503, {}) : res(200))) as any });
  assert.ok((await mk().query('Q', 'query{a}')).data); assert.equal(n, 2);
  n = 0; await assert.rejects(mk().mutate('M', 'mutation{a}', {}), (e: any) => e instanceof OssApiError && e.code === 'server'); assert.equal(n, 1);
  n = 0; assert.ok((await mk().mutate('M', 'mutation{a}', {}, { idempotencyKey: 'k1' })).data); assert.equal(n, 2);
});
test('client: 401 is not retried and is classified; timeout classified', async () => {
  let n = 0; const c = createClient(cfg, { sleep: async () => {}, fetch: (async () => { n++; return res(401, {}); }) as any });
  await assert.rejects(c.query('Q', 'query{a}'), (e: any) => e.code === 'unauthorized'); assert.equal(n, 1);
  const slow = createClient(cfg, { timeoutMs: 20, maxRetries: 0, fetch: ((_u: any, i: any) => new Promise((_r, rej) => i.signal.addEventListener('abort', () => rej(new Error('x'))))) as any });
  await assert.rejects(slow.query('Q', 'query{a}'), (e: any) => e.code === 'timeout');
});
test('client: graphql errors surface, events are emitted', async () => {
  const ev: any[] = []; const c = createClient(cfg, { onEvent: e => ev.push(e), fetch: (async () => res(200, { errors: [{ message: 'bad' }] })) as any });
  await assert.rejects(c.query('Q', 'query{a}'), /bad/); assert.equal(ev[0].outcome, 'error');
});
test('compatibility handshake', () => {
  assert.equal(checkCompatibility({ apiVersion: 'v1', minSdk: '0.1.0' }, '0.1.0').ok, true);
  assert.equal(checkCompatibility({ apiVersion: 'v1', minSdk: '0.2.0' }, '0.1.0').ok, false);
  assert.equal(checkCompatibility({ apiVersion: 'v2', minSdk: '0.1.0' }, '0.1.0').ok, false);
  assert.equal(checkCompatibility({ apiVersion: 'v1', minSdk: '0.1.0', maxSdk: '0.1.5' }, '0.2.0').ok, false);
});

const m1: Manifest = Manifest.parse({ version: 1, entries: { home: { label: 'Home', fields: {
  headline: { type: 'text', label: 'Headline', required: true, max: 60 }, intro: { type: 'richtext', label: 'Intro' }, hero: { type: 'image', label: 'Hero', required: true },
  cta: { type: 'link', label: 'CTA' }, tone: { type: 'select', label: 'Tone', options: ['light', 'dark'] },
  faqs: { type: 'list', label: 'FAQs', max: 3, of: { q: { type: 'text', label: 'Q', required: true }, a: { type: 'richtext', label: 'A', required: true } } } } } } });
test('content: valid body passes; unknown keys, missing required, long text, unsafe link/markup, missing alt are rejected', () => {
  const ok = { headline: 'Hi', hero: { assetId: 'a1', alt: 'A bench' }, cta: { label: 'Shop', href: '/shop' }, faqs: [{ q: 'Q', a: 'A' }] };
  assert.equal(validateEntry(m1, 'home', ok).ok, true);
  for (const bad of [{ ...ok, extra: 1 }, { hero: ok.hero }, { ...ok, headline: 'x'.repeat(61) }, { ...ok, cta: { label: 'x', href: 'javascript:alert(1)' } }, { ...ok, intro: '<script>x</script>' }, { ...ok, hero: { assetId: 'a1' } }, { ...ok, faqs: [1, 2, 3, 4].map(() => ({ q: 'q', a: 'a' })) }])
    assert.equal(validateEntry(m1, 'home', bad).ok, false);
});
test('content: manifest diff separates breaking from additive changes', () => {
  const m2 = structuredClone(m1) as any; m2.version = 2; m2.entries.home.fields.badge = { type: 'text', label: 'Badge', required: false, max: 20 }; delete m2.entries.home.fields.tone; m2.entries.home.fields.cta.required = true;
  const d = diffManifests(m1, m2); assert.ok(d.additive.includes('home.badge added')); assert.ok(d.breaking.includes('home.tone removed')); assert.ok(d.breaking.includes('home.cta became required'));
});

import { tagsFor, buildRevalidationRequest } from './index.ts';
test('tagsFor: scoped to the store, never includes private data, product change refreshes its collections and search', () => {
  const t = tagsFor('store_a', { type: 'product.updated', productId: 'p1', collectionIds: ['c1'] });
  assert.deepEqual(t.sort(), ['store_a:collection:c1', 'store_a:collections', 'store_a:product:p1', 'store_a:search']); assert.ok(t.every(x => x.startsWith('store_a:') && !/cart|order|customer/.test(x)));
});
test('platform-built event verifies end to end at the storefront', async () => {
  const { d, hit } = revDeps(); const r = buildRevalidationRequest(d.secret, { eventId: 'evt-abcdef01', storeId: 'store_a', storefrontId: 'sf_a', sequence: 1, tags: tagsFor('store_a', { type: 'content.published', entry: 'home' }) });
  const out = await handleRevalidation(d, r.body, r.headers['oss-signature']); assert.equal(out.status, 200); assert.deepEqual(hit, ['store_a:content:home']);
});

test('signing vector is shared with the cell dispatcher', () => assert.equal(sign('k'.repeat(40), '{"a":1}', 1700000000), 't=1700000000,v1=65bc88d8b5a50339be3468ec13d7cadb91095faf49ecf51063403f667356507d'));
