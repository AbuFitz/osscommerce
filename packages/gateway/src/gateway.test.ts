import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGateway, classify, TokenBucket, wrap, unwrap, type Resolved } from './index.ts';

const secretA = 'a'.repeat(43), secretB = 'b'.repeat(43), secretP = 'p'.repeat(43);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const REG: Record<string, Resolved> = {
  [sha(secretA)]: { storefrontId: 'sf_a', storeId: 'store_a', env: 'production', liveOrders: true, cellId: 'cell_a', configVersion: 1 },
  [sha(secretB)]: { storefrontId: 'sf_b', storeId: 'store_b', env: 'production', liveOrders: true, cellId: 'cell_b', configVersion: 1 },
  [sha(secretP)]: { storefrontId: 'sf_a_prev', storeId: 'store_a', env: 'preview', liveOrders: false, cellId: 'cell_a', configVersion: 1 },
};
const CELLS: Record<string, any> = { cell_a: { url: 'https://a.cell', channelToken: 'chan-a', mode: 'live', healthy: true }, cell_b: { url: 'https://b.cell', channelToken: 'chan-b', mode: 'live', healthy: true } };

/** A stand-in engine that, like Vendure, keys carts by (channel, session token) and shares customers by email globally. */
function world(over: { cells?: any; registry?: any } = {}) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = []; const audit: any[] = []; const idem = new Map<string, any>(); let n = 0;
  const carts = new Map<string, number>();
  const g = createGateway({
    registry: { resolve: async h => (over.registry ?? REG)[h.toString('hex')] ?? null }, cells: { get: async id => (over.cells ?? CELLS)[id] ?? null },
    storefrontLimit: new TokenBucket(1000, 1000), sessionLimit: new TokenBucket(1000, 1000),
    idempotency: { get: async k => idem.get(k), put: async (k, v) => { idem.set(k, v); } }, audit: { record: e => audit.push(e) }, sessionKey: 'k'.repeat(40),
    upstream: { post: async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      const key = `${init.headers['vendure-token']}|${init.headers.authorization ?? 'new'}`;
      if (!init.headers.authorization) { const tok = `raw-${++n}`; carts.set(`${init.headers['vendure-token']}|Bearer ${tok}`, 1); return { status: 200, headers: { 'vendure-auth-token': tok } as Record<string, string>, body: '{"data":{"ok":1}}' }; }
      return carts.has(key) ? { status: 200, headers: {}, body: '{"data":{"activeOrder":{"id":"1"}}}' } : { status: 200, headers: {} as Record<string, string>, body: '{"data":{"activeOrder":null}}' };
    } },
  });
  return { g, calls, audit };
}
const post = (g: any, secret: string | null, query: string, extra: Record<string, string> = {}, sf = 'sf_a') =>
  g({ headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), 'oss-storefront': sf, ...extra }, body: JSON.stringify({ query }) });
const READ = 'query { products { items { id } } }', ADD = 'mutation { addItemToOrder(productVariantId:"1", quantity:1) { __typename } }', ORDER = 'query { activeOrder { id } }';

test('no/unknown credential is 401; nothing reaches the cell', async () => {
  const w = world(); assert.equal((await post(w.g, null, READ)).status, 401); assert.equal((await post(w.g, 'x'.repeat(43), READ)).status, 401); assert.equal(w.calls.length, 0);
});
test('disabled/expired storefront (registry returns nothing) is refused', async () => {
  const w = world({ registry: {} }); assert.equal((await post(w.g, secretA, READ)).status, 401); assert.equal(w.calls.length, 0);
});
test('claiming another storefront with your own credential is 403', async () => {
  const w = world(); assert.equal((await post(w.g, secretA, READ, {}, 'sf_b')).status, 403); assert.equal(w.calls.length, 0);
});
test('forged channel / auth / cookie headers from the client are never forwarded; the platform picks the channel', async () => {
  const w = world(); await post(w.g, secretA, READ, { 'vendure-token': 'chan-b', cookie: 'session=evil', 'x-forwarded-host': 'b.example.com' });
  assert.equal(w.calls[0].headers['vendure-token'], 'chan-a'); assert.equal(w.calls[0].url, 'https://a.cell/shop-api'); assert.ok(!('cookie' in w.calls[0].headers)); assert.ok(!('x-forwarded-host' in w.calls[0].headers));
});
test('two merchants, same shopper email and same cart ids: each reaches only its own channel, sessions do not cross', async () => {
  const w = world(); const a = await post(w.g, secretA, ADD), b = await post(w.g, secretB, ADD, {}, 'sf_b');
  const sa = a.headers['oss-session'], sb = b.headers['oss-session']; assert.ok(sa && sb && sa !== sb);
  assert.equal(w.calls[0].headers['vendure-token'], 'chan-a'); assert.equal(w.calls[1].headers['vendure-token'], 'chan-b');
  assert.equal((await post(w.g, secretB, ORDER, { 'oss-session': sa }, 'sf_b')).status, 401);       // A's session at B's storefront
  assert.equal((await post(w.g, secretA, ORDER, { 'oss-session': sb }, 'sf_a')).status, 401);
  assert.match((await post(w.g, secretA, ORDER, { 'oss-session': sa })).body, /"id":"1"/);              // and each works at home
  assert.equal((await post(w.g, secretA, ORDER, { 'oss-session': sa + 'x' })).status, 401);           // tampered
});
test('private operations need a session; guest add-to-cart does not', async () => {
  const w = world(); assert.equal((await post(w.g, secretA, ORDER)).status, 401); assert.equal((await post(w.g, secretA, ADD)).status, 200);
});
test('admin-style, unknown, introspection, multi-op, deep and oversized queries are refused', async () => {
  const w = world();
  for (const q of ['query { administrators { items { id } } }', 'query { customers { items { id } } }', 'query { __schema { types { name } } }', 'mutation { createAdministrator(input:{}) { id } }', `${READ} ${READ.replace('query', 'query Two')}`, 'query { products { ' + 'items { '.repeat(14) + 'id' + ' }'.repeat(14) + ' } }', 'query { products { items { id } } } ' + ' '.repeat(21000)])
    assert.equal((await post(w.g, secretA, q)).status, 400, q.slice(0, 40));
  assert.equal(w.calls.length, 0);
});
test('environment safety: preview cannot reach a live cell; production cannot reach a test cell', async () => {
  const w = world(); assert.equal((await post(w.g, secretP, READ, {}, 'sf_a_prev')).status, 403);
  const t = world({ cells: { ...CELLS, cell_a: { ...CELLS.cell_a, mode: 'test' } } }); assert.equal((await post(t.g, secretA, READ)).status, 403);
  const ok = world({ cells: { ...CELLS, cell_a: { ...CELLS.cell_a, mode: 'test' } } }); assert.equal((await post(ok.g, secretP, READ, {}, 'sf_a_prev')).status, 200);
});
test('unhealthy or missing cell is 503, not a fallback to another channel', async () => {
  assert.equal((await post(world({ cells: { cell_a: { ...CELLS.cell_a, healthy: false } } }).g, secretA, READ)).status, 503);
  assert.equal((await post(world({ cells: {} }).g, secretA, READ)).status, 503);
});
test('rate limit per storefront', async () => {
  const calls: any[] = []; const g = createGateway({ registry: { resolve: async h => REG[h.toString('hex')] ?? null }, cells: { get: async id => CELLS[id] }, storefrontLimit: new TokenBucket(2, 0), sessionLimit: new TokenBucket(9, 9), idempotency: { get: async () => undefined, put: async () => {} }, audit: { record() {} }, sessionKey: 'k'.repeat(40), upstream: { post: async (...a: any[]) => { calls.push(a); return { status: 200, headers: {}, body: '{"data":{}}' }; } } });
  const s = [await post(g, secretA, READ), await post(g, secretA, READ), await post(g, secretA, READ)].map(r => r.status); assert.deepEqual(s, [200, 200, 429]);
});
test('idempotent mutation replays the stored response without a second upstream call', async () => {
  const w = world(); const s = (await post(w.g, secretA, ADD)).headers['oss-session'];
  const pay = 'mutation { addPaymentToOrder(input:{method:"stripe-connect", metadata:{}}) { __typename } }';
  const r1 = await post(w.g, secretA, pay, { 'oss-session': s, 'idempotency-key': 'k1' }), before = w.calls.length;
  const r2 = await post(w.g, secretA, pay, { 'oss-session': s, 'idempotency-key': 'k1' }); assert.equal(r2.headers['oss-replayed'], 'true'); assert.equal(w.calls.length, before); assert.equal(r1.body, r2.body);
});
test('private responses are never cacheable; public reads are not stored by shared caches by default', async () => {
  const w = world(); const s = (await post(w.g, secretA, ADD)).headers['oss-session'];
  assert.equal((await post(w.g, secretA, ORDER, { 'oss-session': s })).headers['cache-control'], 'no-store'); assert.match((await post(w.g, secretA, READ)).headers['cache-control'], /public/);
});
test('audit records outcomes without credentials', async () => {
  const w = world(); await post(w.g, secretA, READ); await post(w.g, 'x'.repeat(43), READ);
  assert.ok(w.audit.some(e => e.outcome === 'ok' && e.storeId === 'store_a')); assert.ok(!JSON.stringify(w.audit).includes(secretA));
});
test('classify: guest-friendly mutations and payment detection', () => {
  const p: any = classify('mutation { addPaymentToOrder(input:{method:"x",metadata:{}}) { __typename } }'); assert.equal(p.isPayment, true); assert.equal(p.needsSession, true);
  assert.equal((classify(READ) as any).cacheable, true);
});
test('session wrap/unwrap round trip is storefront-bound', () => { const s = wrap('k'.repeat(40), 'sf_a', 'raw'); assert.equal(unwrap('k'.repeat(40), 'sf_a', s), 'raw'); assert.equal(unwrap('k'.repeat(40), 'sf_b', s), null); assert.equal(unwrap('j'.repeat(40), 'sf_a', s), null); });

test('createPaymentSession is allowed, needs a session, and is not a payment-completing operation', () => {
  const c: any = classify('mutation { createPaymentSession { clientSecret publishableKey } }'); assert.equal(c.ok, true); assert.equal(c.needsSession, true); assert.equal(c.isPayment, false);
});
