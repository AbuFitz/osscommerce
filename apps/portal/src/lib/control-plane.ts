import 'server-only';
import { Pool, type PoolClient } from 'pg';
import type { Automation, AutomationRun, EmailSettings, PaymentSetup, Readiness, StorefrontView } from './gateway';
import { GATE_COPY, LAUNCH_GATES } from './gateway';
import type { StoreRecord } from '@oss-commerce/contracts';
import { automationOutcome, paymentView } from './control-plane-mapping';

type Row = Record<string, any>;

export interface ControlPlanePort {
  store(storeId: string, fallbackName: string): Promise<{ store: StoreRecord; readiness: Readiness[] }>;
  payment(storeId: string, applicationFeeBp: number): Promise<PaymentSetup>;
  automations(storeId: string): Promise<{ rules: Automation[]; runs: AutomationRun[]; runsLimit: number }>;
  setAutomation(storeId: string, id: string, enabled: boolean): Promise<{ ok: boolean; message: string }>;
  emailSettings(storeId: string, fallbackName: string): Promise<EmailSettings>;
  saveEmailSettings(storeId: string, brand: Partial<EmailSettings['brand']>, notifications: Record<string, boolean>): Promise<{ ok: boolean; message: string }>;
  storefront(storeId: string): Promise<StorefrontView | null>;
}

export class PgControlPlane implements ControlPlanePort {
  constructor(private readonly pool: Pool) {}

  private async tx<T>(storeId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.store_id', $1, true)", [storeId]);
      const value = await fn(client);
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async store(storeId: string, fallbackName: string) {
    return this.tx(storeId, async client => {
      const s = (await client.query('select * from cp.stores where store_id=$1', [storeId])).rows[0];
      if (!s) throw new Error('Store is not registered in the control plane.');
      const hosts = (await client.query('select host, verified from cp.store_hostnames where store_id=$1 order by verified desc, host', [storeId])).rows;
      const payment = await this.paymentIn(client, storeId, 0);
      const domain = hosts.some(h => h.verified === true);
      const ready: Record<string, boolean> = {
        contract_signed: false,
        payments_enabled: payment.chargesEnabled,
        domain_verified: domain,
        test_order_passed: false,
        launch_approved: s.lifecycle === 'ready' || s.lifecycle === 'live',
      };
      const readiness = LAUNCH_GATES.map(gate => ({ gate, done: ready[gate], ...GATE_COPY[gate] }));
      return {
        store: {
          storeId: s.store_id,
          organisationId: s.organisation_id,
          cellId: s.cell_id,
          hostnames: hosts.map(h => ({ host: h.host, verified: h.verified })),
          region: s.region,
          lifecycle: s.lifecycle,
          entitlementVersion: s.entitlement_version,
          paymentReadiness: payment.status === 'enabled' ? 'enabled' : payment.status === 'not_started' ? 'not_started' : payment.status === 'onboarding' ? 'onboarding' : 'restricted',
        } as StoreRecord,
        readiness,
        name: fallbackName,
      };
    });
  }

  private async paymentIn(client: PoolClient, storeId: string, fee: number) {
    const row = (await client.query(`select a.* from cp.store_payment_accounts b join cp.payment_accounts a using (payment_account_id) where b.store_id=$1`, [storeId])).rows[0];
    return paymentView(row, fee);
  }

  payment(storeId: string, fee: number) { return this.tx(storeId, client => this.paymentIn(client, storeId, fee)); }

  async automations(storeId: string) {
    return this.tx(storeId, async client => {
      const [rules, runs, settings] = await Promise.all([
        client.query(`select r.*, count(x.id)::int runs_month, max(x.updated_at) last_run from cp.automation_rules r left join cp.automation_runs x on x.rule_id=r.id and x.store_id=r.store_id and x.created_at >= date_trunc('month', now()) where r.store_id=$1 group by r.id order by r.kind, r.name`, [storeId]),
        client.query(`select x.*, r.name automation_name from cp.automation_runs x join cp.automation_rules r on r.id=x.rule_id where x.store_id=$1 order by x.updated_at desc limit 50`, [storeId]),
        client.query('select automation_runs_per_month from cp.automation_settings where store_id=$1', [storeId]),
      ]);
      return {
        rules: rules.rows.map((r): Automation => ({ id: r.id, name: r.name, trigger: r.trigger, action: r.action?.template ?? r.action?.type ?? 'Email', kind: r.kind, enabled: r.enabled, lastRun: r.last_run ? new Date(r.last_run).toISOString() : undefined, runsMonth: Number(r.runs_month), needsConsent: r.kind === 'marketing' })),
        runs: runs.rows.map((r): AutomationRun => ({ id: r.id, at: new Date(r.updated_at).toISOString(), automation: r.automation_name, event: r.event_type, outcome: automationOutcome(r), detail: r.skip_reason ?? (r.status === 'sent' ? 'Email sent.' : r.status.replaceAll('_', ' ')) })),
        runsLimit: Number(settings.rows[0]?.automation_runs_per_month ?? 0),
      };
    });
  }

  setAutomation(storeId: string, id: string, enabled: boolean) {
    return this.tx(storeId, async client => {
      const row = (await client.query('select kind, enabled from cp.automation_rules where store_id=$1 and id=$2', [storeId, id])).rows[0];
      if (!row) return { ok: false, message: 'That automation does not exist for this store.' };
      if (row.kind === 'transactional' && !enabled) return { ok: false, message: 'Essential order emails cannot be turned off.' };
      await client.query('update cp.automation_rules set enabled=$3, version=version+1, updated_at=now() where store_id=$1 and id=$2', [storeId, id, enabled]);
      return { ok: true, message: `${enabled ? 'Turned on' : 'Turned off'}.` };
    });
  }

  emailSettings(storeId: string, fallbackName: string) {
    return this.tx(storeId, async client => {
      const r = (await client.query('select * from cp.email_profiles where store_id=$1', [storeId])).rows[0];
      if (!r) return { brand: { shopName: fallbackName, accent: '#0e1311', supportEmail: '', footer: '' }, notifications: {}, sendingDomain: { host: '', verified: false } };
      return { brand: { shopName: r.shop_name, accent: r.accent, supportEmail: r.support_email, footer: r.footer ?? '' }, notifications: r.template_edits?.notifications ?? {}, sendingDomain: { host: r.sending_domain, verified: r.domain_status === 'verified' } };
    });
  }

  saveEmailSettings(storeId: string, brand: Partial<EmailSettings['brand']>, notifications: Record<string, boolean>) {
    return this.tx(storeId, async client => {
      const result = await client.query(`update cp.email_profiles set shop_name=coalesce($2,shop_name), accent=coalesce($3,accent), support_email=coalesce($4,support_email), footer=coalesce($5,footer), template_edits=jsonb_set(template_edits,'{notifications}',$6::jsonb,true), updated_at=now() where store_id=$1`, [storeId, brand.shopName ?? null, brand.accent ?? null, brand.supportEmail ?? null, brand.footer ?? null, JSON.stringify(notifications)]);
      return result.rowCount === 1 ? { ok: true, message: 'Email settings saved.' } : { ok: false, message: 'Set up a sending domain before saving email settings.' };
    });
  }

  storefront(storeId: string): Promise<StorefrontView | null> {
    return this.tx(storeId, async client => {
      const f = (await client.query(`select f.*, h.host, h.verified from cp.storefronts f left join cp.storefront_hosts h using (storefront_id) where f.store_id=$1 order by (f.env='production') desc, f.created_at desc limit 1`, [storeId])).rows[0];
      if (!f) return null;
      const deployments = (await client.query('select * from cp.storefront_deployments where store_id=$1 and storefront_id=$2 order by created_at desc limit 10', [storeId, f.storefront_id])).rows;
      const current = deployments[0];
      return {
        theme: { name: f.name, version: current?.git_sha?.slice(0, 7) ?? String(f.config_version), deployedAt: current?.created_at ? new Date(current.created_at).toISOString() : new Date(f.updated_at).toISOString(), state: current?.state === 'error' ? 'failed' : ['ready', 'promoted'].includes(current?.state) ? 'healthy' : 'building' },
        previewUrl: current?.url ? `https://${String(current.url).replace(/^https?:\/\//, '')}` : '#',
        liveUrl: f.state === 'live' && f.verified && f.host ? `https://${f.host}` : null,
        checks: [{ label: 'Domain verified', ok: f.verified === true, detail: f.verified ? f.host : 'DNS is not verified yet.' }, { label: 'Deployment ready', ok: ['ready', 'promoted'].includes(current?.state), detail: current?.state ?? 'No deployment yet.' }],
        history: deployments.map((d, i) => ({ version: d.git_sha?.slice(0, 7) ?? d.deployment_id, at: new Date(d.created_at).toISOString(), note: d.state, current: i === 0 })),
      };
    });
  }
}

const globalPool = globalThis as unknown as { __ossPortalControlPlanePool?: Pool };
export function controlPlaneFromEnv(): ControlPlanePort | null {
  const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
  if (!connectionString) return null;
  const pool = globalPool.__ossPortalControlPlanePool ??= new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  return new PgControlPlane(pool);
}
