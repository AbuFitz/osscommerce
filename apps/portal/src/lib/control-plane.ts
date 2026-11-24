import 'server-only';
import { Pool, type PoolClient } from 'pg';
import type { AccessGrant, Automation, AutomationRun, Billing, ContentView, EmailSettings, LegalPage, PaymentSetup, Preferences, Readiness, ServiceRequest, StorefrontView } from './gateway';
import { GATE_COPY, LAUNCH_GATES } from './gateway';
import { LAUNCH_PLAN, type StoreRecord } from '@oss-commerce/contracts';
import { automationOutcome, grantTransition, paymentView, platformBillingView, portalPublicBaseUrl, stripeBillingSecret, stripeOnboardingConfig } from './control-plane-mapping';
import { liveBilling, liveConnect, type BillingPort, type ConnectPort } from '@oss-commerce/payments';
import { isUuid, serviceRequestView, validateServiceRequest } from './service-requests';
import { legalPagesFromRows, validateLegalBody } from './legal-content';
import { defaultHomepage, homepageView, parseHomepageBody, validateSectionFields } from './homepage-content';
import { liveDomainVerification, VERCEL_CNAME, type DomainVerificationPort } from './domain-verification';

type Row = Record<string, any>;

export interface ControlPlanePort {
  store(storeId: string, fallbackName: string): Promise<{ store: StoreRecord; readiness: Readiness[] }>;
  payment(storeId: string, applicationFeeBp: number): Promise<PaymentSetup>;
  billing(storeId: string): Promise<Billing>;
  startBillingPortal(storeId: string): Promise<{ ok: true; mode: 'hosted'; url: string } | { ok: false; message: string }>;
  startPaymentSetup(storeId: string): Promise<{ ok: true; mode: 'hosted'; url: string } | { ok: false; message: string }>;
  automations(storeId: string): Promise<{ rules: Automation[]; runs: AutomationRun[]; runsLimit: number }>;
  setAutomation(storeId: string, id: string, enabled: boolean): Promise<{ ok: boolean; message: string }>;
  emailSettings(storeId: string, fallbackName: string): Promise<EmailSettings>;
  preferences(storeId: string): Promise<Preferences>;
  savePreferences(storeId: string, preferences: Preferences): Promise<{ ok: boolean; message: string }>;
  saveEmailSettings(storeId: string, brand: Partial<EmailSettings['brand']>, notifications: Record<string, boolean>): Promise<{ ok: boolean; message: string }>;
  storefront(storeId: string): Promise<StorefrontView | null>;
  grants(storeId: string): Promise<AccessGrant[]>;
  decideGrant(storeId: string, id: string, decision: 'approve' | 'decline' | 'revoke'): Promise<{ ok: boolean; message: string }>;
  serviceRequests(storeId: string): Promise<ServiceRequest[]>;
  createServiceRequest(storeId: string, kind: ServiceRequest['kind'], title: string, detail: string): Promise<{ ok: boolean; message: string }>;
  decideQuote(storeId: string, id: string, approve: boolean): Promise<{ ok: boolean; message: string }>;
  content(storeId: string, storeName: string): Promise<ContentView>;
  saveSection(storeId: string, storeName: string, sectionId: string, fields: Record<string, string>): Promise<{ ok: boolean; message: string }>;
  publishContent(storeId: string, storeName: string): Promise<{ ok: boolean; message: string }>;
  requestLaunch(storeId: string): Promise<{ ok: boolean; message: string }>;
  checkDomain(storeId: string): Promise<{ ok: boolean; message: string; record?: { type: string; name: string; value: string } }>;
  legalPages(storeId: string): Promise<LegalPage[]>;
  saveLegal(storeId: string, slug: LegalPage['slug'], body: string, publish: boolean): Promise<{ ok: boolean; message: string }>;
}

export class PgControlPlane implements ControlPlanePort {
  constructor(
    private readonly pool: Pool,
    private readonly payments?: { connect: ConnectPort; publicBaseUrl: string },
    private readonly platformBilling?: { billing: BillingPort; publicBaseUrl?: string },
    private readonly domainVerification: DomainVerificationPort = liveDomainVerification(),
  ) {}

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
      const hosts = (await client.query(`select host,bool_or(verified) verified from (select host,verified from cp.store_hostnames where store_id=$1 union all select h.host,h.verified from cp.storefront_hosts h join cp.storefronts f using(storefront_id) where f.store_id=$1) x group by host order by verified desc,host`, [storeId])).rows;
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

  async billing(storeId: string): Promise<Billing> {
    const base = { demo: false, planName: LAUNCH_PLAN.name, monthlyMinor: LAUNCH_PLAN.monthlyMinor, buildMinor: LAUNCH_PLAN.buildFromMinor };
    const account = await this.tx(storeId, async client => (await client.query(
      'select stripe_customer_id,stripe_subscription_id,plan_id from cp.platform_billing_accounts where store_id=$1',
      [storeId],
    )).rows[0]);
    if (!account || !this.platformBilling) return { ...base, status: 'not_started', invoices: [] };
    if (account.plan_id !== LAUNCH_PLAN.id) throw new Error('The store billing plan is not supported by this portal deployment.');
    return platformBillingView(base, await this.platformBilling.billing.read(account.stripe_customer_id, account.stripe_subscription_id ?? undefined));
  }

  async startBillingPortal(storeId: string) {
    if (!this.platformBilling?.publicBaseUrl) return { ok: false as const, message: 'Billing management is not configured on this deployment.' };
    const customer = await this.tx(storeId, async client => (await client.query('select stripe_customer_id from cp.platform_billing_accounts where store_id=$1', [storeId])).rows[0]?.stripe_customer_id as string | undefined);
    if (!customer) return { ok: false as const, message: 'Your billing account is still being provisioned. Nothing was changed.' };
    const session = await this.platformBilling.billing.createPortalSession(customer, `${this.platformBilling.publicBaseUrl}/account/billing`);
    await this.tx(storeId, async client => { await client.query(`insert into cp.audit_log(store_id,actor,action,after) values ($1,'merchant','billing.portal_opened',$2::jsonb)`, [storeId, JSON.stringify({ customer: `${customer.slice(0, 8)}…` })]); });
    return { ok: true as const, mode: 'hosted' as const, url: session.url };
  }

  async startPaymentSetup(storeId: string) {
    if (!this.payments) return { ok: false as const, message: 'Stripe onboarding is not configured on this deployment.' };
    const account = await this.tx(storeId, async client => (await client.query(`select a.stripe_account_id from cp.store_payment_accounts b join cp.payment_accounts a using (payment_account_id) where b.store_id=$1`, [storeId])).rows[0]?.stripe_account_id as string | undefined);
    if (!account) return { ok: false as const, message: 'Your payment account is still being provisioned. Nothing was changed.' };
    const root = this.payments.publicBaseUrl;
    const link = await this.payments.connect.createAccountLink({ account, returnUrl: `${root}/settings/payments?stripe=returned`, refreshUrl: `${root}/settings/payments?stripe=refresh` });
    await this.tx(storeId, async client => { await client.query(`insert into cp.audit_log(store_id,actor,action,after) values ($1,'merchant','payments.hosted_onboarding_opened',$2::jsonb)`, [storeId, JSON.stringify({ account: `${account.slice(0, 8)}…` })]); });
    return { ok: true as const, mode: 'hosted' as const, url: link.url };
  }

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

  preferences(storeId: string) {
    return this.tx(storeId, async client => {
      const row = (await client.query(`select low_stock_alert,new_order_alert,guest_checkout,ask_marketing_consent,show_sold_out,checkout_paused from cp.store_preferences where store_id=$1`, [storeId])).rows[0];
      if (!row) throw new Error('Store preferences are not provisioned.');
      return { lowStock: row.low_stock_alert, newOrder: row.new_order_alert, guest: row.guest_checkout, consent: row.ask_marketing_consent, showSoldOut: row.show_sold_out, pause: row.checkout_paused };
    });
  }

  savePreferences(storeId: string, p: Preferences) {
    return this.tx(storeId, async client => {
      await client.query(`select cp.update_store_preferences($1,$2,$3,$4,$5,$6,$7)`, [storeId, p.lowStock, p.newOrder, p.guest, p.consent, p.showSoldOut, p.pause]);
      return { ok: true, message: 'Preferences saved.' };
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
      const f = (await client.query(`select f.*, h.host, h.verified from cp.storefronts f left join cp.storefront_hosts h using (storefront_id) where f.store_id=$1 order by (f.env='production') desc, h.verified desc nulls last, f.created_at desc limit 1`, [storeId])).rows[0];
      if (!f) return null;
      const deployments = (await client.query('select * from cp.storefront_deployments where store_id=$1 and storefront_id=$2 order by created_at desc limit 10', [storeId, f.storefront_id])).rows;
      const launch = (await client.query(`select state from cp.store_launch_requests where store_id=$1`, [storeId])).rows[0];
      const current = deployments[0];
      return {
        theme: { name: f.name, version: current?.git_sha?.slice(0, 7) ?? String(f.config_version), deployedAt: current?.created_at ? new Date(current.created_at).toISOString() : new Date(f.updated_at).toISOString(), state: current?.state === 'error' ? 'failed' : ['ready', 'promoted'].includes(current?.state) ? 'healthy' : 'building' },
        previewUrl: current?.url ? `https://${String(current.url).replace(/^https?:\/\//, '')}` : '#',
        liveUrl: f.state === 'live' && f.verified && f.host ? `https://${f.host}` : null,
        checks: [{ label: 'Domain verified', ok: f.verified === true, detail: f.verified ? f.host : 'DNS is not verified yet.' }, { label: 'Deployment ready', ok: ['ready', 'promoted'].includes(current?.state), detail: current?.state ?? 'No deployment yet.' }],
        history: deployments.map((d, i) => ({ version: d.git_sha?.slice(0, 7) ?? d.deployment_id, at: new Date(d.created_at).toISOString(), note: d.state, current: i === 0 })),
        launchRequested: launch?.state === 'pending' || launch?.state === 'approved',
      };
    });
  }

  grants(storeId: string) {
    return this.tx(storeId, async client => {
      const rows = (await client.query(`select * from cp.access_grants where store_id=$1 and state in ('pending','active') order by (state='pending') desc, requested_at desc`, [storeId])).rows;
      return rows.map((r): AccessGrant => ({ id: r.id, who: r.grantee_user_id, purpose: r.purpose, scopes: r.scopes, write: r.write_access, state: r.state, expires: new Date(r.expires_at).toISOString() }));
    });
  }

  decideGrant(storeId: string, id: string, decision: 'approve' | 'decline' | 'revoke') {
    return this.tx(storeId, async client => {
      const row = (await client.query('select * from cp.access_grants where store_id=$1 and id=$2 for update', [storeId, id])).rows[0];
      if (!row) return { ok: false, message: 'That access request no longer exists.' };
      const next = grantTransition(row.state, decision, new Date(row.expires_at));
      if (!next) return { ok: false, message: 'That access request has already changed. Refresh the page.' };
      await client.query('update cp.access_grants set state=$3, decided_by=$4, decided_at=now() where store_id=$1 and id=$2', [storeId, id, next, 'merchant']);
      await client.query(`insert into cp.audit_log(store_id,actor,action,before,after) values ($1,'merchant',$2,$3::jsonb,$4::jsonb)`, [storeId, `access.${next}`, JSON.stringify({ id, state: row.state }), JSON.stringify({ id, state: next })]);
      if (next === 'expired') return { ok: false, message: 'That access request has expired. No access was granted.' };
      return { ok: true, message: next === 'active' ? 'Access approved.' : next === 'declined' ? 'Access declined.' : 'Access revoked.' };
    });
  }

  serviceRequests(storeId: string) {
    return this.tx(storeId, async client => {
      const rows = (await client.query('select * from cp.service_requests where store_id=$1 order by created_at desc limit 100', [storeId])).rows;
      return rows.map(serviceRequestView);
    });
  }

  createServiceRequest(storeId: string, kind: ServiceRequest['kind'], title: string, detail: string) {
    const clean = validateServiceRequest(title, detail);
    if (clean.error) return Promise.resolve({ ok: false, message: clean.error });
    return this.tx(storeId, async client => { await client.query('select cp.create_service_request($1,$2,$3,$4)', [storeId, kind, clean.title, clean.detail]); return { ok: true, message: 'Request sent. We will reply with a quote before any paid work starts.' }; });
  }

  decideQuote(storeId: string, id: string, approve: boolean) {
    if (!isUuid(id)) return Promise.resolve({ ok: false, message: 'That quote no longer exists.' });
    return this.tx(storeId, async client => {
      const row = (await client.query('select * from cp.decide_service_quote($1,$2::uuid,$3)', [storeId, id, approve])).rows[0];
      if (!row?.changed) return { ok: false, message: 'That quote is no longer open. Refresh the page.' };
      return { ok: true, message: approve ? 'Quote approved. Work can now begin.' : 'Quote declined. Nothing will be charged.' };
    });
  }

  content(storeId: string, storeName: string) {
    return this.tx(storeId, async client => {
      const rows = (await client.query(`select revision,body,published_at,created_at from cp.content_revisions where store_id=$1 and entry='page/home' order by revision desc limit 20`, [storeId])).rows;
      const host = (await client.query(`select h.host from cp.storefront_hosts h join cp.storefronts f using(storefront_id) where f.store_id=$1 and h.verified order by (f.env='production') desc limit 1`, [storeId])).rows[0]?.host;
      const deployment = (await client.query(`select d.url from cp.storefront_deployments d where d.store_id=$1 and d.state in ('ready','promoted') and d.url is not null order by d.created_at desc limit 1`, [storeId])).rows[0]?.url;
      const rawUrl = host ?? deployment; const shopUrl = rawUrl ? `https://${String(rawUrl).replace(/^https?:\/\//, '')}` : undefined;
      return homepageView(rows, storeName, shopUrl);
    });
  }

  saveSection(storeId: string, storeName: string, sectionId: string, fields: Record<string, string>) {
    if (!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(sectionId)) return Promise.resolve({ ok: false, message: 'That section does not exist.' });
    return this.tx(storeId, async client => {
      const latest = (await client.query(`select body from cp.content_revisions where store_id=$1 and entry='page/home' order by revision desc limit 1`, [storeId])).rows[0];
      const body = latest ? parseHomepageBody(latest.body) : defaultHomepage(storeName); const section = body.sections.find(item => item.id === sectionId);
      if (!section) return { ok: false, message: 'That section does not exist.' };
      const checked = validateSectionFields(section.type, fields); if (!checked.ok) return checked;
      const next = { sections: body.sections.map(item => item.id === sectionId ? { ...item, fields: checked.fields } : item) };
      await client.query('select * from cp.save_content_draft($1,$2,$3::jsonb,$4)', [storeId, 'page/home', JSON.stringify(next), 'merchant']);
      return { ok: true, message: 'Section saved as a draft.' };
    });
  }

  publishContent(storeId: string, storeName: string) {
    return this.tx(storeId, async client => {
      let latest = (await client.query(`select revision,body,published_at from cp.content_revisions where store_id=$1 and entry='page/home' order by revision desc limit 1`, [storeId])).rows[0];
      if (!latest) {
        await client.query('select * from cp.save_content_draft($1,$2,$3::jsonb,$4)', [storeId, 'page/home', JSON.stringify(defaultHomepage(storeName)), 'merchant']);
        latest = { published_at: null };
      } else parseHomepageBody(latest.body);
      if (latest.published_at) return { ok: false, message: 'There are no draft changes to publish.' };
      const result = (await client.query('select * from cp.publish_content_entry($1,$2,$3)', [storeId, 'page/home', 'merchant'])).rows[0];
      return result?.changed ? { ok: true, message: 'Homepage published.' } : { ok: false, message: 'The homepage could not be published. Refresh and try again.' };
    });
  }

  requestLaunch(storeId: string) {
    return this.tx(storeId, async client => {
      const changed = (await client.query(`select cp.request_store_launch($1) changed`, [storeId])).rows[0]?.changed === true;
      return changed ? { ok: true, message: 'Launch review requested. We will run the final checks and confirm the next step.' } : { ok: false, message: 'Launch review has already been requested.' };
    });
  }

  async checkDomain(storeId: string) {
    const row = await this.tx(storeId, async client => (await client.query(`select h.host,h.verified from cp.storefront_hosts h join cp.storefronts f using(storefront_id) where f.store_id=$1 order by (f.env='production') desc,h.verified desc,f.created_at desc limit 1`, [storeId])).rows[0]);
    if (!row?.host) return { ok: false, message: 'No storefront domain has been registered yet.' };
    if (row.verified) return { ok: true, message: `${row.host} is verified.` };
    const record = { type: 'CNAME', name: row.host, value: VERCEL_CNAME };
    if (!await this.domainVerification.check(row.host)) return { ok: false, message: 'Add this DNS record, wait for it to propagate, then check again.', record };
    const changed = await this.tx(storeId, async client => (await client.query('select cp.record_domain_verification($1,$2) verified', [storeId, row.host])).rows[0]?.verified === true);
    return changed ? { ok: true, message: `${row.host} is verified. SSL will finish automatically.` } : { ok: false, message: 'The DNS record is correct, but this domain is no longer registered to the storefront.' };
  }

  legalPages(storeId: string) {
    return this.tx(storeId, async client => {
      const rows = (await client.query(`select distinct on(entry) entry,body,published_at,created_at from cp.content_revisions where store_id=$1 and entry=any($2::text[]) order by entry,revision desc`, [storeId, ['legal/privacy','legal/terms','legal/shipping','legal/returns']])).rows;
      return legalPagesFromRows(rows);
    });
  }

  saveLegal(storeId: string, slug: LegalPage['slug'], body: string, publish: boolean) {
    const valid = validateLegalBody(slug, body, publish); if (!valid.ok) return Promise.resolve(valid);
    return this.tx(storeId, async client => {
      const entry = `legal/${valid.slug}`; await client.query('select * from cp.save_content_draft($1,$2,$3::jsonb,$4)', [storeId, entry, JSON.stringify({ body: valid.body }), 'merchant']);
      if (publish) { const result = (await client.query('select * from cp.publish_content_entry($1,$2,$3)', [storeId, entry, 'merchant'])).rows[0]; if (!result?.changed) throw new Error('The draft could not be published.'); }
      return { ok: true, message: publish ? 'Page published.' : 'Draft saved.' };
    });
  }
}

const globalPool = globalThis as unknown as { __ossPortalControlPlanePool?: Pool };
export function controlPlaneFromEnv(): ControlPlanePort | null {
  const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
  if (!connectionString) return null;
  const pool = globalPool.__ossPortalControlPlanePool ??= new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  const config = stripeOnboardingConfig({ secret: process.env.STRIPE_SECRET_KEY, appEnv: process.env.APP_ENV, publicUrl: process.env.PORTAL_PUBLIC_URL, vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL });
  const payments = config ? { connect: liveConnect(config.secret), publicBaseUrl: config.publicBaseUrl } : undefined;
  const billingSecret = stripeBillingSecret(process.env.STRIPE_BILLING_SECRET_KEY, process.env.APP_ENV);
  const publicBaseUrl = portalPublicBaseUrl(process.env.PORTAL_PUBLIC_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? undefined;
  return new PgControlPlane(pool, payments, billingSecret ? { billing: liveBilling(billingSecret), publicBaseUrl } : undefined);
}
