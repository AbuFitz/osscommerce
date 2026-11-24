import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from './config.ts';

const good = { APP_ENV: 'staging', CONTROL_PLANE_DATABASE_URL: 'postgres://runtime:secret@db.example/commerce?sslmode=require', GATEWAY_SESSION_KEY: 'a'.repeat(64) };
test('gateway config accepts a scoped TLS runtime and safe defaults', () => { const c = loadConfig(good); assert.equal(c.PORT, 3300); assert.equal(c.DATABASE_POOL_MAX, 10); });
test('gateway config fails closed on weak sessions, plaintext databases and public secrets', () => {
  assert.throws(() => loadConfig({ ...good, GATEWAY_SESSION_KEY: 'short' }), /GATEWAY_SESSION_KEY/);
  assert.throws(() => loadConfig({ ...good, CONTROL_PLANE_DATABASE_URL: 'postgres://runtime:secret@db.example/commerce' }), /require TLS/);
  assert.throws(() => loadConfig({ ...good, NEXT_PUBLIC_GATEWAY_SESSION_KEY: 'x' }), /NEXT_PUBLIC/);
});
