import pg from 'pg';
import { createServer, PgAudit, PgCells, PgContent, PgIdempotency, PgPreferences, PgRegistry, TokenBucket } from '@oss-commerce/gateway';
import type { GatewayConfig } from './config.ts';

export async function assertRuntimeRole(pool: pg.Pool) {
  const { rows } = await pool.query(`select current_user,
    pg_has_role(current_user,'oss_runtime','member') runtime_member,
    pg_get_userbyid(c.relowner) table_owner
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='cp' and c.relname='stores'`);
  const row = rows[0];
  if (!row) throw new Error('Control-plane schema is not migrated.');
  if (row.runtime_member !== true) throw new Error('Gateway database role must inherit oss_runtime.');
  if (row.current_user === row.table_owner) throw new Error('Gateway database role must not own control-plane tables.');
}

export async function createRuntime(config: GatewayConfig) {
  const pool = new pg.Pool({ connectionString: config.CONTROL_PLANE_DATABASE_URL, max: config.DATABASE_POOL_MAX, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, application_name: 'oss-gateway' });
  pool.on('error', () => undefined);
  try { await assertRuntimeRole(pool); }
  catch (error) { await pool.end(); throw error; }
  const server = createServer({
    registry: new PgRegistry(pool), cells: new PgCells(pool), idempotency: new PgIdempotency(pool), audit: new PgAudit(pool), content: new PgContent(pool), preferences: new PgPreferences(pool),
    storefrontLimit: new TokenBucket(config.STOREFRONT_BURST, config.STOREFRONT_PER_SECOND), sessionLimit: new TokenBucket(config.SESSION_BURST, config.SESSION_PER_SECOND),
    sessionKey: config.GATEWAY_SESSION_KEY, timeoutMs: config.UPSTREAM_TIMEOUT_MS,
    ready: async () => { await pool.query('select 1'); return true; },
  });
  return { pool, server };
}
