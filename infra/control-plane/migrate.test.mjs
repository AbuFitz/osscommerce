import assert from 'node:assert/strict';
import test from 'node:test';
import { checksum, discoverMigrations, validateApplied } from './migrate.mjs';

test('migration catalogue is contiguous, named consistently and checksummed', async () => {
  const migrations = await discoverMigrations();
  assert.equal(migrations[0].version, '0001_control_plane');
  assert.equal(migrations.at(-1).version, '0010_migration_checksums');
  assert.deepEqual(migrations.map(m => m.number), Array.from({ length: migrations.length }, (_, i) => i + 1));
  assert.ok(migrations.every(m => /^[0-9a-f]{64}$/.test(m.checksum)));
});

test('plan returns only unapplied migrations', async () => {
  const migrations = await discoverMigrations();
  const applied = migrations.slice(0, 4).map(m => ({ version: m.version, checksum: m.checksum }));
  assert.deepEqual(validateApplied(migrations, applied).map(m => m.version), migrations.slice(4).map(m => m.version));
});

test('unknown database versions and edited applied files fail closed', async () => {
  const migrations = await discoverMigrations();
  assert.throws(() => validateApplied(migrations, [{ version: '9999_future', checksum: null }]), /does not know/);
  assert.throws(() => validateApplied(migrations, [{ version: migrations[0].version, checksum: checksum('changed') }]), /drift detected/);
});

test('once checksum support is applied, every recorded migration must have a checksum', async () => {
  const migrations = await discoverMigrations();
  const applied = migrations.map(m => ({ version: m.version, checksum: m.version === '0003_automation' ? null : m.checksum }));
  assert.throws(() => validateApplied(migrations, applied), /checksum missing: 0003_automation/);
  assert.deepEqual(validateApplied(migrations, applied, { allowMissingChecksums: true }), []);
});
