import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { CATALOGUE, byId, connectable, readyToAdvertise, Manifest, newConnection, transition, usable, IllegalTransition, seal, open, rotate, VaultError, redact, assertAllowedUrl, runHealth, type Connection, type ProviderAdapter } from './index.ts';

test('catalogue: every manifest is valid, unique, and discloses who pays', () => {
  assert.equal(new Set(CATALOGUE.map(m => m.id)).size, CATALOGUE.length); assert.ok(CATALOGUE.length >= 12);
  for (const m of CATALOGUE) { assert.ok(m.cost.note.length > 10, m.id); assert.ok(m.regions.includes('GB')); }
});
test('catalogue: nothing is advertised as available without the full evidence set', () => {
  for (const m of CATALOGUE) if (m.availability === 'available') assert.equal(readyToAdvertise(m).ok, true, `${m.id} is marked available without evidence`);
  assert.deepEqual(connectable().map(m => m.id), [], 'today no provider has sandbox proof, so none is offered as connectable');
  const r = readyToAdvertise(byId('royal_mail_click_drop')!); assert.equal(r.ok, false); assert.ok(r.missing.includes('provider approval')); assert.ok(r.missing.includes('sandbox proof'));
});
test('catalogue: providers that call out must name their hosts; no http, no wildcards, no private hosts', () => {
  for (const m of CATALOGUE) for (const h of m.allowedHosts) assert.match(h, /^[a-z0-9.-]+\.[a-z]{2,}$/, m.id);
  for (const m of CATALOGUE.filter(m => m.auth.type === 'api_key' || m.auth.type === 'oauth')) if (!['shipstation', 'maplibre_maps'].includes(m.id))  assert.ok(m.allowedHosts.length > 0, `${m.id} has no allowed hosts`);
});
test('catalogue: an unverifiable claim cannot be constructed', () => {
  const m = { ...byId('postcodes_io')!, availability: 'available' as const }; assert.equal(readyToAdvertise(m).ok, false);
  assert.throws(() => Manifest.parse({ ...byId('postcodes_io'), id: 'Bad Id' }));
});

const base = () => newConnection('c1', 'store_a', 'ideal_postcodes', 'live');
test('connection: the happy path, and illegal jumps are refused', () => {
  let c = base(); assert.throws(() => transition(c, { type: 'verified' }), IllegalTransition); assert.throws(() => transition(c, { type: 'authorised', credentialRef: 'x' }), IllegalTransition);
  c = transition(c, { type: 'begin' }); c = transition(c, { type: 'authorised', credentialRef: 'ref1', externalAccountId: 'ext' }); assert.equal(c.state, 'pending'); assert.equal(usable(c), false);
  c = transition(c, { type: 'verified' }); assert.equal(c.state, 'connected'); assert.equal(usable(c), true);
});
test('connection: one blip does not degrade; three consecutive failures do; recovery clears it', () => {
  let c = transition(transition(transition(base(), { type: 'begin' }), { type: 'authorised', credentialRef: 'r' }), { type: 'verified' });
  c = transition(c, { type: 'health_failed', at: 1, code: 'timeout', message: 'slow' }); assert.equal(c.state, 'connected');
  c = transition(c, { type: 'health_ok', at: 2 }); assert.equal(c.failures, 0);
  for (let i = 0; i < 3; i++) c = transition(c, { type: 'health_failed', at: 3 + i, code: 'timeout', message: 'slow' }); assert.equal(c.state, 'degraded'); assert.equal(usable(c), true); assert.equal(c.lastError?.code, 'timeout');
  c = transition(c, { type: 'health_ok', at: 9 }); assert.equal(c.state, 'connected'); assert.equal(c.lastError, undefined);
});
test('connection: revoked and disabled connections are not usable and are not revived by a health check', () => {
  let c = transition(transition(transition(base(), { type: 'begin' }), { type: 'authorised', credentialRef: 'r' }), { type: 'verified' });
  const d = transition(c, { type: 'disable' }); assert.equal(usable(d), false); assert.equal(transition(d, { type: 'health_ok', at: 1 }).state, 'disabled'); assert.equal(transition(d, { type: 'enable' }).state, 'connected');
  const r = transition(c, { type: 'auth_revoked', at: 5 }); assert.equal(r.state, 'revoked'); assert.equal(transition(r, { type: 'health_ok', at: 6 }).state, 'revoked'); assert.equal(transition(r, { type: 'begin' }).state, 'configuring', 'reconnect');
});
test('disconnect returns to available and carries no credential reference or error', () => {
  const c = transition(transition(transition(transition(base(), { type: 'begin' }), { type: 'authorised', credentialRef: 'secret-ref', externalAccountId: 'ext' }), { type: 'verified' }), { type: 'disconnect' });
  assert.equal(c.state, 'available'); assert.equal(c.credentialRef, undefined); assert.equal(c.externalAccountId, undefined);
});

const ring = () => ({ current: 'k2', keys: { k1: randomBytes(32), k2: randomBytes(32) } });
const ctx = { storeId: 'store_a', connectionId: 'c1' };
test('vault: round trip; ciphertext differs each time; plaintext not present', () => {
  const k = ring(), a = seal(k, 'sk-live-supersecret', ctx), b = seal(k, 'sk-live-supersecret', ctx); assert.notEqual(a, b); assert.ok(!a.includes('supersecret')); assert.equal(open(k, a, ctx), 'sk-live-supersecret');
});
test('vault: bound to its tenant and connection; tampering and wrong keys fail with one message', () => {
  const k = ring(), blob = seal(k, 'secret', ctx);
  for (const bad of [{ ...ctx, storeId: 'store_b' }, { ...ctx, connectionId: 'c2' }]) assert.throws(() => open(k, blob, bad), VaultError);
  const parts = blob.split('.'); parts[3] = Buffer.from('tampered').toString('base64url'); assert.throws(() => open(k, parts.join('.'), ctx), /Cannot decrypt/);
  assert.throws(() => open({ current: 'k2', keys: { k2: randomBytes(32), k1: randomBytes(32) } }, blob, ctx), /Cannot decrypt/); assert.throws(() => seal({ current: 'x', keys: { x: Buffer.alloc(8) } }, 'a', ctx), /Invalid/);
});
test('vault: rotation re-encrypts under the new key and old blobs stay readable until then', () => {
  const k1 = { current: 'k1', keys: { k1: randomBytes(32) } }; const old = seal(k1, 'secret', ctx);
  const k = { current: 'k2', keys: { ...k1.keys, k2: randomBytes(32) } }; assert.equal(open(k, old, ctx), 'secret'); const fresh = rotate(k, old, ctx); assert.match(fresh, /^v1\.k2\./); assert.equal(open({ current: 'k2', keys: { k2: k.keys.k2 } }, fresh, ctx), 'secret');
});

test('redact: removes provided secrets, key-shaped tokens, bearer tokens and emails', () => {
  const m = redact('401 for Bearer abcdef123456789 key sk_live_abcdef1234 user maya@example.com secret hunter2hunter2', ['hunter2hunter2']);
  for (const leak of ['abcdef123456789', 'sk_live_abcdef1234', 'maya@example.com', 'hunter2hunter2']) assert.ok(!m.includes(leak), leak);
});
test('SSRF guard: only listed https hosts', () => {
  const m = byId('ideal_postcodes')!; assertAllowedUrl(m, 'https://api.ideal-postcodes.co.uk/v1/x');
  for (const bad of ['http://api.ideal-postcodes.co.uk/', 'https://evil.example.com/', 'https://127.0.0.1/', 'https://localhost/', 'https://user:pw@api.ideal-postcodes.co.uk/', 'https://api.ideal-postcodes.co.uk.evil.com/', 'file:///etc/passwd', 'nope']) assert.throws(() => assertAllowedUrl(m, bad), /./, bad);
});

function runner(adapterHealth: () => Promise<{ ok: boolean; code?: string; message?: string }>) {
  const saved: Connection[] = []; const audit: any[] = []; let allow = true;
  const adapter = { manifest: byId('ideal_postcodes')!, validate: async () => ({ ok: true }), health: async () => adapterHealth() } as ProviderAdapter;
  const d = { adapter, load: async () => ({ apiKey: 'live_key_123456' }), now: () => 100, limit: () => allow, save: async (c: Connection) => { saved.push(c); }, audit: async (e: any) => { audit.push(e); } };
  const conn = transition(transition(transition(base(), { type: 'begin' }), { type: 'authorised', credentialRef: 'r' }), { type: 'verified' });
  return { d, conn, saved, audit, deny: () => { allow = false; } };
}
test('health runner: failures are redacted and counted; 401 revokes; rate-limited checks are skipped, not failed', async () => {
  const f = runner(async () => ({ ok: false, code: 'bad', message: 'rejected key live_key_123456 for maya@example.com' })); const c = await runHealth(f.d, f.conn); assert.equal(c.failures, 1); assert.ok(!c.lastError!.message.includes('live_key_123456')); assert.ok(!c.lastError!.message.includes('@'));
  const r = runner(async () => { throw new Error('HTTP 401 unauthorized'); }); assert.equal((await runHealth(r.d, r.conn)).state, 'revoked'); assert.ok(r.audit.some(a => a.action === 'integration.connected_to_revoked'));
  const s = runner(async () => ({ ok: false })); s.deny(); assert.equal((await runHealth(s.d, s.conn)).failures, 0); assert.equal(s.saved.length, 0);
});
