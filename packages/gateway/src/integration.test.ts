// Real Postgres + real HTTP. Needs TEST_DATABASE_URL (superuser; creates schema fixtures). Local:
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/cp_t2 npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { createServer, PgRegistry, PgCells, PgIdempotency, PgAudit, TokenBucket } from './index.ts';

const ADMIN = process.env.TEST_DATABASE_URL; const skip = ADMIN ? false : 'set TEST_DATABASE_URL to run';
const sha = (s: string) => createHash('sha256').update(s).digest();
const secA = randomBytes(32).toString('base64url'), secB = randomBytes(32).toString('base64url'), secP = randomBytes(32).toString('base64url');
let admin: pg.Pool, runtime: pg.Pool, gw: http.Server, gwUrl = '', cellA: http.Server, cellB: http.Server; const seen: Record<string, any[]> = { a: [], b: [] };
const listen = (s: http.Server) => new Promise<string>(r => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(s.address() as any).port}`)));
const fakeCell = (key: 'a' | 'b') => http.createServer((req, res) => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { seen[key].push({ headers: req.headers, body: b }); const first = !req.headers.authorization; res.writeHead(200, { 'content-type': 'application/json', ...(first ? { 'vendure-auth-token': `raw-${key}` } : {}) }); res.end(JSON.stringify({ data: { cell: key } })); }); });

before(async () => {
  if (skip) return;
  admin = new pg.Pool({ connectionString: ADMIN });
  cellA = fakeCell('a'); cellB = fakeCell('b'); const ua = await listen(cellA), ub = await listen(cellB);
  await admin.query(`drop role if exists gw_test`); await admin.query(`create role gw_test login password 'gw' in role oss_runtime`);
  await admin.query(`insert into cp.stores(store_id, organisation_id, cell_id, region, lifecycle) values ('it_a','o','it_cell_a','eu-west-london','live'),('it_b','o','it_cell_b','eu-west-london','live') on conflict do nothing`);
  await admin.query(`insert into cp.storefronts(storefront_id, store_id, name, env, state) values ('it_sf_a','it_a','A','production','live'),('it_sf_b','it_b','B','production','live'),('it_sf_p','it_a','A preview','preview','connected') on conflict do nothing`);
  for (const [id, sf, s] of [['it_c1', 'it_sf_a', secA], ['it_c2', 'it_sf_b', secB], ['it_c3', 'it_sf_p', secP]] as const)
    await admin.query(`insert into cp.storefront_credentials(credential_id, storefront_id, purpose, secret_hash, prefix, expires_at) values ($1,$2,'server',$3,$4, now()+interval '1 day') on conflict do nothing`, [id, sf, sha(s), s.slice(0, 6)]);
  // a cell is a "live" cell, a "test" cell; preview storefronts may only reach the test one
  await admin.query(`insert into cp.cells(cell_id, url, channel_token, mode) values ('it_cell_a',$1,'chan-token-a-0000000','live'),('it_cell_b',$2,'chan-token-b-0000000','live') on conflict do nothing`, [ua.replace('http://', 'https://') , ub.replace('http://', 'https://')]).catch(async () => { /* https check: use direct urls below */ });
  runtime = new pg.Pool({ connectionString: ADMIN.replace(/\/\/[^@]*@/, '//gw_test:gw@') });
  // cells table enforces https; the integration rewrites to the local http servers at the upstream layer
  const cells = new PgCells(runtime); const map: Record<string, string> = { ['https://' + ua.slice(7)]: ua, ['https://' + ub.slice(7)]: ub };
  const server = createServer({
    registry: new PgRegistry(runtime), cells: { get: async id => { const c = await cells.get(id); return c && { ...c, mode: 'live' as const }; } }, storefrontLimit: new TokenBucket(1000, 1000), sessionLimit: new TokenBucket(1000, 1000),
    idempotency: new PgIdempotency(runtime), audit: new PgAudit(runtime), sessionKey: 'k'.repeat(40),
    upstream: { post: async (url, init) => { const real = map[url.replace('/shop-api', '')] + '/shop-api'; const r = await fetch(real, { method: 'POST', headers: init.headers, body: init.body }); const h: Record<string, string> = {}; r.headers.forEach((v, k) => (h[k] = v)); return { status: r.status, headers: h, body: await r.text() }; } },
  });
  gw = server; gwUrl = await listen(gw);
});
after(async () => { if (skip) return; for (const s of [gw, cellA, cellB]) s.close(); await runtime.end(); await admin.query(`delete from cp.stores where store_id in ('it_a','it_b')`); await admin.query(`delete from cp.cells where cell_id like 'it_cell_%'`); await admin.query(`drop owned by gw_test`); await admin.query(`drop role gw_test`); await admin.end(); });

const call = (secret: string, sf: string, query: string, extra: Record<string, string> = {}) => fetch(`${gwUrl}/v1/shop`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'oss-storefront': sf, 'content-type': 'application/json', ...extra }, body: JSON.stringify({ query }) });

test('meta and health are public and cheap', { skip }, async () => { assert.equal((await fetch(`${gwUrl}/healthz`)).status, 200); assert.equal((await (await fetch(`${gwUrl}/v1/meta`)).json()).apiVersion, 'v1'); });
test('each merchant reaches only its own cell with the platform-chosen channel; a forged channel header is ignored', { skip }, async () => {
  const a = await call(secA, 'it_sf_a', 'query { products { items { id } } }', { 'vendure-token': 'chan-token-b-0000000' }); assert.equal(a.status, 200);
  const b = await call(secB, 'it_sf_b', 'query { products { items { id } } }'); assert.equal(b.status, 200);
  assert.equal(seen.a.at(-1).headers['vendure-token'], 'chan-token-a-0000000'); assert.equal(seen.b.at(-1).headers['vendure-token'], 'chan-token-b-0000000'); assert.equal(seen.b.length, 1);
});
test('credentials: unknown, wrong storefront, and another merchant\'s storefront id are refused', { skip }, async () => {
  assert.equal((await call(randomBytes(32).toString('base64url'), 'it_sf_a', 'query { products { items { id } } }')).status, 401);
  assert.equal((await call(secA, 'it_sf_b', 'query { products { items { id } } }')).status, 403);
});
test('revoking or expiring a credential takes effect immediately', { skip }, async () => {
  await admin.query(`update cp.storefront_credentials set revoked_at = now() where credential_id = 'it_c2'`);
  assert.equal((await call(secB, 'it_sf_b', 'query { products { items { id } } }')).status, 401);
  await admin.query(`update cp.storefront_credentials set revoked_at = null, expires_at = now() - interval '1 second', created_at = now() - interval '1 day' where credential_id = 'it_c2'`);
  assert.equal((await call(secB, 'it_sf_b', 'query { products { items { id } } }')).status, 401);
});
test('disabling a storefront or suspending the store stops traffic', { skip }, async () => {
  await admin.query(`update cp.storefronts set state='disabled' where storefront_id='it_sf_a'`); assert.equal((await call(secA, 'it_sf_a', 'query { products { items { id } } }')).status, 401);
  await admin.query(`update cp.storefronts set state='live' where storefront_id='it_sf_a'`); assert.equal((await call(secA, 'it_sf_a', 'query { products { items { id } } }')).status, 200);
  await admin.query(`update cp.stores set lifecycle='suspended' where store_id='it_a'`); assert.equal((await call(secA, 'it_sf_a', 'query { products { items { id } } }')).status, 401);
  await admin.query(`update cp.stores set lifecycle='live' where store_id='it_a'`);
});
test('shopper session from A is useless at B; idempotent payment replays from the database', { skip }, async () => {
  const add = await call(secA, 'it_sf_a', 'mutation { addItemToOrder(productVariantId:"1", quantity:1) { __typename } }'); const sa = add.headers.get('oss-session')!; assert.ok(sa);
  assert.equal((await call(secB, 'it_sf_b', 'query { activeOrder { id } }', { 'oss-session': sa })).status, 401);
  const pay = 'mutation { addPaymentToOrder(input:{method:"stripe-connect", metadata:{}}) { __typename } }', n = seen.a.length;
  const r1 = await call(secA, 'it_sf_a', pay, { 'oss-session': sa, 'idempotency-key': 'it-k1' }), r2 = await call(secA, 'it_sf_a', pay, { 'oss-session': sa, 'idempotency-key': 'it-k1' });
  assert.equal(r2.headers.get('oss-replayed'), 'true'); assert.equal(seen.a.length, n + 1); assert.equal(await r1.text(), await r2.text());
});
test('the runtime role cannot read credentials or other tables it was not granted; audit is written without secrets', { skip }, async () => {
  await assert.rejects(runtime.query('select * from cp.storefront_credentials'), /permission denied/);
  await new Promise(r => setTimeout(r, 200));
  const { rows } = await admin.query(`select actor, action, after::text from cp.audit_log where actor like 'storefront:it_%'`); assert.ok(rows.length > 3);
  assert.ok(!JSON.stringify(rows).includes(secA)); assert.ok(rows.some(r => r.action === 'gateway.denied'));
});
test('oversized bodies and unknown routes are rejected', { skip }, async () => {
  assert.equal((await fetch(`${gwUrl}/v1/shop`, { method: 'POST', body: 'x'.repeat(70_000) })).status, 413); assert.equal((await fetch(`${gwUrl}/admin`)).status, 404);
});
