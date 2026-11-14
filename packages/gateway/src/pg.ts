import type { Pool } from 'pg';
import type { Registry, CellDirectory, IdempotencyStore, Audit, Resolved } from './ports.ts';

/** Postgres adapters. The pool must connect as a role that is a member of oss_runtime and NOT the table owner,
 *  so row-level security and the narrow security-definer functions are the only way in. */
export class PgRegistry implements Registry {
  constructor(private pool: Pool) {}
  async resolve(hash: Buffer): Promise<Resolved | null> {
    const r = await this.pool.query('select * from cp.resolve_storefront($1, $2)', [hash, 'server']);
    const x = r.rows[0]; if (!x) return null;
    void this.pool.query('select cp.touch_storefront_credential($1)', [hash]).catch(() => {});     // usage stamp must never fail a request
    return { storefrontId: x.storefront_id, storeId: x.store_id, env: x.env, liveOrders: x.live_orders, cellId: x.cell_id, configVersion: x.config_version };
  }
}
export class PgCells implements CellDirectory {
  constructor(private pool: Pool) {}
  async get(cellId: string) {
    const r = await this.pool.query('select * from cp.get_cell($1)', [cellId]); const x = r.rows[0];
    return x ? { url: x.url as string, channelToken: x.channel_token as string, mode: x.mode as 'live' | 'test', healthy: x.healthy as boolean } : null;
  }
}
export class PgIdempotency implements IdempotencyStore {
  constructor(private pool: Pool) {}
  async get(key: string) { const [sf, k] = split(key); const r = await this.pool.query('select status, body from cp.gateway_idempotency where storefront_id=$1 and key=$2', [sf, k]); return r.rows[0]; }
  async put(key: string, v: { status: number; body: string }) { const [sf, k] = split(key); await this.pool.query('insert into cp.gateway_idempotency(storefront_id,key,status,body) values ($1,$2,$3,$4) on conflict do nothing', [sf, k, v.status, v.body]); }
}
const split = (k: string): [string, string] => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; };

/** Append-only audit. Never contains credentials or request bodies. Failures are counted, not thrown: auditing must not take the shop down. */
export class PgAudit implements Audit {
  failures = 0;
  constructor(private pool: Pool) {}
  record(e: { storefrontId?: string; storeId?: string; operation?: string; outcome: string; reason?: string; requestId: string }) {
    void this.pool.query('insert into cp.audit_log(store_id, actor, action, after, correlation_id) values ($1,$2,$3,$4,$5)',
      [e.storeId ?? null, e.storefrontId ? `storefront:${e.storefrontId}` : 'storefront:unknown', `gateway.${e.outcome}`, JSON.stringify({ operation: e.operation, reason: e.reason }), e.requestId]).catch(() => { this.failures++; });
  }
}
