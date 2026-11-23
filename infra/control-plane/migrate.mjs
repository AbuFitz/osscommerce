import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(HERE, 'migrations');
const LOCK = 733_041_009;

export function checksum(sql) { return createHash('sha256').update(sql).digest('hex'); }

export async function discoverMigrations(dir = MIGRATIONS_DIR) {
  const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  const migrations = await Promise.all(names.map(async name => {
    const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
    if (!match) throw new Error(`Invalid migration filename: ${name}`);
    const sql = await readFile(path.join(dir, name), 'utf8');
    return { number: Number(match[1]), version: name.slice(0, -4), name, sql, checksum: checksum(sql) };
  }));
  if (!migrations.length) throw new Error('No control-plane migrations found');
  migrations.forEach((migration, index) => {
    if (migration.number !== index + 1) throw new Error(`Migration sequence must be contiguous from 0001; found ${migration.name} at position ${index + 1}`);
  });
  return migrations;
}

export function validateApplied(migrations, applied, { allowMissingChecksums = false } = {}) {
  const local = new Map(migrations.map(m => [m.version, m]));
  const checksumsRequired = applied.some(row => row.version === '0010_migration_checksums');
  for (const row of applied) {
    const migration = local.get(row.version);
    if (!migration) throw new Error(`Database has migration ${row.version}, which this release does not know`);
    if (checksumsRequired && !row.checksum && !allowMissingChecksums) throw new Error(`Migration checksum missing: ${row.version}; run the migrator once to adopt it`);
    if (row.checksum && row.checksum !== migration.checksum) throw new Error(`Applied migration drift detected: ${row.version}`);
  }
  const done = new Set(applied.map(row => row.version));
  return migrations.filter(migration => !done.has(migration.version));
}

async function relationState(client) {
  const result = await client.query("select to_regnamespace('cp') is not null schema_exists, to_regclass('cp.schema_migrations') is not null table_exists");
  return result.rows[0];
}

async function checksumColumnExists(client) {
  const result = await client.query("select exists(select 1 from information_schema.columns where table_schema='cp' and table_name='schema_migrations' and column_name='checksum') present");
  return result.rows[0].present;
}

async function appliedRows(client) {
  if (!(await checksumColumnExists(client))) return (await client.query('select version, null::text checksum from cp.schema_migrations order by version')).rows;
  return (await client.query('select version, checksum from cp.schema_migrations order by version')).rows;
}

async function transaction(client, fn) {
  await client.query('begin');
  try { const result = await fn(); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback').catch(() => {}); throw error; }
}

async function applyOne(client, migration) {
  await transaction(client, async () => {
    await client.query(migration.sql);
    const recorded = await client.query('select 1 from cp.schema_migrations where version = $1', [migration.version]);
    if (recorded.rowCount !== 1) throw new Error(`${migration.name} did not record itself in cp.schema_migrations`);
    if (await checksumColumnExists(client)) await client.query('update cp.schema_migrations set checksum = $2 where version = $1', [migration.version, migration.checksum]);
  });
}

async function adoptChecksums(client, migrations) {
  if (!(await checksumColumnExists(client))) return;
  await transaction(client, async () => {
    for (const migration of migrations) {
      await client.query('update cp.schema_migrations set checksum = $2 where version = $1 and checksum is null', [migration.version, migration.checksum]);
    }
  });
}

export async function migrate({ connectionString, check = false, log = console.log }) {
  if (!connectionString) throw new Error('CONTROL_PLANE_DATABASE_URL is required');
  const migrations = await discoverMigrations();
  const client = new pg.Client({ connectionString, application_name: 'oss-control-plane-migrator' });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK]);
    const readOnly = (await client.query("select current_setting('transaction_read_only') value")).rows[0].value;
    if (readOnly !== 'off') throw new Error('Migration connection is read-only');
    const state = await relationState(client);
    if (state.schema_exists && !state.table_exists) throw new Error('cp exists without cp.schema_migrations; reconcile the partially bootstrapped database manually');
    if (!state.table_exists) {
      if (check) return { applied: [], pending: migrations.map(m => m.version) };
      const first = migrations[0], second = migrations[1];
      if (first?.number !== 1 || second?.number !== 2) throw new Error('Bootstrap requires migrations 0001 and 0002');
      await transaction(client, async () => { await client.query(first.sql); await client.query(second.sql); });
      log(`applied ${first.version}`); log(`applied ${second.version}`);
    }
    let applied = await appliedRows(client);
    let pending = validateApplied(migrations, applied, { allowMissingChecksums: !check });
    if (check) return { applied: applied.map(row => row.version), pending: pending.map(m => m.version) };
    for (const migration of pending) { await applyOne(client, migration); log(`applied ${migration.version}`); }
    await adoptChecksums(client, migrations);
    applied = await appliedRows(client);
    pending = validateApplied(migrations, applied);
    if (pending.length) throw new Error(`Migrations still pending: ${pending.map(m => m.version).join(', ')}`);
    return { applied: applied.map(row => row.version), pending: [] };
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    await client.end().catch(() => {});
  }
}

async function main() {
  const check = process.argv.slice(2).includes('--check');
  const result = await migrate({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL, check });
  if (check && result.pending.length) { console.error(`pending: ${result.pending.join(', ')}`); process.exitCode = 2; }
  else console.log(`control plane current (${result.applied.length} migrations)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(`migration failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; });
