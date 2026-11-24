import type { Pool, PoolClient } from 'pg';
import type { DomainEvent, EventType, Rule, Run } from './model.ts';
import type { EventStore, RuleStore, RunStore, SuppressionPort } from './ports.ts';
import { createHash } from 'node:crypto';
import type { CommerceEmailProfile } from './commerce-email.ts';
import type { SuppressionReason } from './resend.ts';

/** Postgres adapters for the control-plane tables. Every query runs inside a transaction that first sets app.store_id,
 *  so row-level security confines it to one merchant. Connect as a non-owner role (e.g. oss_runtime members), never the table owner. */
export class PgStores {
  constructor(private pool: Pool) {}
  private async tx<T>(storeId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try { await c.query('begin'); await c.query("select set_config('app.store_id', $1, true)", [storeId]); const r = await fn(c); await c.query('commit'); return r; }
    catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  }
  private toRule = (r: Record<string, any>): Rule => ({ id: r.id, storeId: r.store_id, name: r.name, version: r.version, trigger: r.trigger, kind: r.kind, enabled: r.enabled, delaySeconds: r.delay_seconds, conditions: r.conditions, guard: r.guard ?? undefined, throttle: r.throttle ?? undefined, action: r.action });
  private toRun = (r: Record<string, any>): Run => ({ id: r.id, storeId: r.store_id, ruleId: r.rule_id, ruleVersion: r.rule_version, kind: r.kind, eventId: r.event_id, eventType: r.event_type, idempotencyKey: r.idempotency_key, recipient: r.recipient ?? undefined, runAt: new Date(r.run_at).toISOString(), status: r.status, skipReason: r.skip_reason ?? undefined, attempts: r.attempts, messageId: r.message_id ?? undefined, createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString() });

  rules: RuleStore = {
    rulesFor: (storeId, trigger: EventType) => this.tx(storeId, async c => (await c.query('select * from cp.automation_rules where store_id = $1 and trigger = $2', [storeId, trigger])).rows.map(this.toRule)),
    rule: (storeId, id) => this.tx(storeId, async c => { const r = (await c.query('select * from cp.automation_rules where store_id = $1 and id = $2', [storeId, id])).rows[0]; return r ? this.toRule(r) : null; }),
  };
  events: EventStore = {
    save: (e: DomainEvent) => this.tx(e.storeId, async c => { await c.query('insert into cp.automation_events (store_id, id, type, payload) values ($1,$2,$3,$4) on conflict do nothing', [e.storeId, e.id, e.type, e]); }),
    get: (storeId, id) => this.tx(storeId, async c => { const r = (await c.query('select payload from cp.automation_events where store_id = $1 and id = $2', [storeId, id])).rows[0]; return r ? (r.payload as DomainEvent) : null; }),
  };
  runs: RunStore = {
    insertIfAbsent: (r: Run) => this.tx(r.storeId, async c => (await c.query(
      `insert into cp.automation_runs (id, store_id, rule_id, rule_version, event_id, event_type, kind, idempotency_key, recipient, recipient_hash, run_at, status, attempts, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict (idempotency_key) do nothing returning id`,
      [r.id, r.storeId, r.ruleId, r.ruleVersion, r.eventId, r.eventType, r.kind, r.idempotencyKey, r.recipient ?? null, r.recipient ? createHash('sha256').update(r.recipient.toLowerCase()).digest('hex') : null, r.runAt, r.status, JSON.stringify(r.attempts), r.createdAt, r.updatedAt])).rowCount === 1),
    get: (storeId, id) => this.tx(storeId, async c => { const r = (await c.query('select * from cp.automation_runs where store_id = $1 and id = $2', [storeId, id])).rows[0]; return r ? this.toRun(r) : null; }),
    update: (storeId, id, p) => this.tx(storeId, async c => { await c.query('update cp.automation_runs set status = coalesce($3, status), skip_reason = $4, message_id = coalesce($5, message_id), attempts = coalesce($6::jsonb, attempts), updated_at = coalesce($7, now()) where store_id = $1 and id = $2',
      [storeId, id, p.status ?? null, p.skipReason ?? null, p.messageId ?? null, p.attempts ? JSON.stringify(p.attempts) : null, p.updatedAt ?? null]); }),
    countSent: (storeId, ruleId, recipient, since) => this.tx(storeId, async c => Number((await c.query("select count(*) n from cp.automation_runs where store_id = $1 and rule_id = $2 and recipient = $3 and status = 'sent' and updated_at >= $4", [storeId, ruleId, recipient, since])).rows[0].n)),
    countNonEssentialThisMonth: (storeId, month) => this.tx(storeId, async c => Number((await c.query("select count(*) n from cp.automation_runs where store_id = $1 and kind <> 'transactional' and status = 'sent' and updated_at >= $2::date", [storeId, `${month}-01`])).rows[0].n)),
  };
  suppression: SuppressionPort & { add(storeId: string, email: string, reason: 'bounce' | 'complaint' | 'unsubscribe' | 'manual'): Promise<void> } = {
    isSuppressed: (storeId, email) => this.tx(storeId, async c => (await c.query('select 1 from cp.email_suppressions where store_id = $1 and email = $2', [storeId, email.toLowerCase()])).rowCount === 1),
    add: (storeId, email, reason) => this.tx(storeId, async c => { await c.query('insert into cp.email_suppressions (store_id, email, reason) values ($1,$2,$3) on conflict do nothing', [storeId, email.toLowerCase(), reason]); }),
  };

  consent = {
    hasMarketingConsent: (storeId: string, email: string): Promise<boolean> => this.tx(storeId, async c => {
      const row = (await c.query('select granted from cp.marketing_consent where store_id=$1 and email=$2 order by occurred_at desc, id desc limit 1', [storeId, email.toLowerCase()])).rows[0];
      return row?.granted === true;
    }),
    record: (storeId: string, email: string, granted: boolean, source: string): Promise<void> => this.tx(storeId, async c => { await c.query('insert into cp.marketing_consent(store_id,email,granted,source) values ($1,$2,$3,$4)', [storeId, email.toLowerCase(), granted, source]); }),
  };

  /** Record withdrawal and suppression together so an unsubscribe can never partially apply. */
  unsubscribe = (storeId: string, email: string): Promise<void> => this.tx(storeId, async c => {
    const normalized = email.toLowerCase();
    await c.query('insert into cp.marketing_consent(store_id,email,granted,source) values ($1,$2,false,$3)', [storeId, normalized, 'unsubscribe_link']);
    await c.query("insert into cp.email_suppressions (store_id, email, reason) values ($1,$2,'unsubscribe') on conflict (store_id, email) do update set reason = excluded.reason", [storeId, normalized]);
  });

  state = {
    checkoutCompleted: (storeId: string, checkoutId: string): Promise<boolean> => this.tx(storeId, async c => (await c.query("select 1 from cp.automation_events where store_id=$1 and type='checkout.completed' and payload #>> '{subject,checkoutId}'=$2 limit 1", [storeId, checkoutId])).rowCount === 1),
    orderCancelled: (storeId: string, orderId: string): Promise<boolean> => this.tx(storeId, async c => (await c.query("select 1 from cp.automation_events where store_id=$1 and type='order.cancelled' and payload #>> '{subject,orderId}'=$2 limit 1", [storeId, orderId])).rowCount === 1),
  };

  limits = {
    automationRunsPerMonth: (storeId: string): Promise<number> => this.tx(storeId, async c => Number((await c.query('select automation_runs_per_month n from cp.automation_settings where store_id=$1', [storeId])).rows[0]?.n ?? 0)),
    quietHours: (storeId: string): Promise<{ tz: string; from: number; to: number } | null> => this.tx(storeId, async c => { const r = (await c.query('select timezone, quiet_from, quiet_to from cp.automation_settings where store_id=$1', [storeId])).rows[0]; return r && r.quiet_from !== null && r.quiet_to !== null ? { tz: r.timezone, from: r.quiet_from, to: r.quiet_to } : null; }),
  };

  emailProfile = {
    get: (storeId: string): Promise<CommerceEmailProfile | null> => this.tx(storeId, async c => {
      const r = (await c.query(`select p.*, (select h.host from cp.storefronts f join cp.storefront_hosts h using (storefront_id)
        where f.store_id = p.store_id and f.env = 'production' and f.state = 'live' and h.verified = true order by h.host limit 1) storefront_host
        from cp.email_profiles p where p.store_id = $1 and p.domain_status = $2`, [storeId, 'verified'])).rows[0];
      if (!r?.storefront_host) return null;
      return {
        fromName: r.from_name,
        fromEmail: `${r.from_local_part}@${r.sending_domain}`,
        replyTo: r.reply_to ?? undefined,
        storefrontUrl: `https://${r.storefront_host}`,
        brand: { shopName: r.shop_name, accent: r.accent, logoUrl: r.logo_url ?? undefined, supportEmail: r.support_email, address: r.postal_address ?? undefined, footer: r.footer ?? undefined },
        edits: r.template_edits,
      };
    }),
  };

  /** Resolve the tenant from our stored provider message id, never from webhook-supplied store metadata. */
  async resolveStoreForEmailMessage(messageId: string): Promise<string | null> {
    const r = (await this.pool.query('select cp.resolve_email_message($1) store_id', [messageId])).rows[0];
    return r?.store_id ?? null;
  }

  emailWebhook = {
    apply: (input: { providerEventId: string; storeId: string; messageId: string; type: string; suppression?: { email: string; reason: SuppressionReason } }): Promise<'applied' | 'duplicate'> => this.tx(input.storeId, async c => {
      const inserted = await c.query('insert into cp.email_webhook_events (provider_event_id, store_id, message_id, type) values ($1,$2,$3,$4) on conflict do nothing returning provider_event_id', [input.providerEventId, input.storeId, input.messageId, input.type]);
      if (!inserted.rowCount) return 'duplicate';
      if (input.suppression) await c.query('insert into cp.email_suppressions (store_id, email, reason) values ($1,$2,$3) on conflict (store_id, email) do update set reason = excluded.reason', [input.storeId, input.suppression.email.toLowerCase(), input.suppression.reason]);
      return 'applied';
    }),
  };
}
