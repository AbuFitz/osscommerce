/** What OSS decided about the connected-account model (ADR 0005). Expressed as data so it is reviewed, tested and applied uniformly. */
export const ACCOUNT_MODEL = {
  charge: 'direct',                       // PaymentIntent is created on the merchant's account; the merchant is merchant of record
  feesPaidBy: 'account',                  // Stripe collects processing fees from the merchant; no OSS processing-fee exposure
  lossesBy: 'stripe',                     // Stripe is responsible for negative balances; confirm eligibility in writing before launch
  dashboard: 'full',                      // merchants keep their own Stripe Dashboard; immutable per account, so this is a one-way choice
  onboarding: 'embedded',                 // hosted onboarding is the fallback
  applicationFee: 'per_agreement',        // from the merchant agreement (packages/contracts), never from the browser
} as const;

/** Components a merchant owner may be granted. Anything else is refused server-side, whatever the browser asks for. */
export const ALLOWED_COMPONENTS = ['account_onboarding', 'account_management', 'notification_banner', 'payments', 'payouts', 'balances', 'payment_details', 'disputes_list'] as const;
export type Component = typeof ALLOWED_COMPONENTS[number];
/** Components that change who gets paid. They require a recent re-authentication of the portal user (step-up) on top of owner membership. */
export const SENSITIVE: ReadonlySet<Component> = new Set(['account_management', 'account_onboarding']);

export interface ConnectPort {
  createAccount(p: { storeId: string; email?: string; country: 'GB'; businessUrl?: string; idempotencyKey: string }): Promise<{ id: string }>;
  createAccountSession(p: { account: string; components: Component[] }): Promise<{ clientSecret: string; expiresAt: number }>;
  createAccountLink(p: { account: string; returnUrl: string; refreshUrl: string }): Promise<{ url: string }>;
  retrieveAccount(account: string): Promise<import('./account-state.ts').StripeAccountLite>;
  registerPaymentMethodDomain(account: string, domain: string): Promise<{ id: string; enabled: boolean; applePay: boolean; googlePay: boolean; link: boolean }>;
}
export interface AccountRegistry {
  accountFor(storeId: string): Promise<string | null>;
  bind(storeId: string, account: string): Promise<void>;
  audit(e: { storeId: string; actor: string; action: string; detail?: string }): Promise<void>;
}
export interface Caller { userId: string; storeId: string; role: 'owner' | 'admin' | 'staff' | 'support'; reauthenticatedAt?: number }

export class Forbidden extends Error {}
const STEP_UP_SECONDS = 600;

/** Creates (or reuses) the merchant's connected account. One store, one account: a retry never creates a second one. */
export async function ensureAccount(d: { connect: ConnectPort; reg: AccountRegistry }, c: Caller, p: { email?: string; businessUrl?: string }): Promise<{ account: string; created: boolean }> {
  if (c.role !== 'owner') throw new Forbidden('Only the store owner can set up payments.');
  const existing = await d.reg.accountFor(c.storeId); if (existing) return { account: existing, created: false };
  const a = await d.connect.createAccount({ storeId: c.storeId, email: p.email, country: 'GB', businessUrl: p.businessUrl, idempotencyKey: `acct:${c.storeId}` });
  await d.reg.bind(c.storeId, a.id); await d.reg.audit({ storeId: c.storeId, actor: c.userId, action: 'payments.account_created' });
  return { account: a.id, created: true };
}

/** Account Session for embedded components. The account always comes from OUR registry for the caller's store, never from the request. */
export async function startSession(d: { connect: ConnectPort; reg: AccountRegistry; now?: () => number }, c: Caller, wanted: string[]): Promise<{ clientSecret: string; expiresAt: number; components: Component[] }> {
  const account = await d.reg.accountFor(c.storeId); if (!account) throw new Forbidden('Payments have not been set up for this store.');
  const comps = wanted.filter((w): w is Component => (ALLOWED_COMPONENTS as readonly string[]).includes(w));
  if (comps.length !== wanted.length || !comps.length) throw new Forbidden('That component is not available.');
  const needsOwner = comps.some(x => SENSITIVE.has(x));
  if (needsOwner) {
    if (c.role !== 'owner') throw new Forbidden('Only the store owner can change payment details.');
    const now = (d.now ?? Date.now)() / 1000; if (!c.reauthenticatedAt || now - c.reauthenticatedAt > STEP_UP_SECONDS) throw new Forbidden('Please confirm your password to continue.');
  } else if (!['owner', 'admin'].includes(c.role)) throw new Forbidden('You do not have access to payments.');
  const s = await d.connect.createAccountSession({ account, components: comps });
  await d.reg.audit({ storeId: c.storeId, actor: c.userId, action: 'payments.session', detail: comps.join(',') });
  return { ...s, components: comps };
}

/** Apple Pay, Google Pay and Link need every checkout domain registered on the connected account. Called when a storefront domain is verified. */
export async function registerCheckoutDomain(d: { connect: ConnectPort; reg: AccountRegistry }, storeId: string, domain: string) {
  const account = await d.reg.accountFor(storeId); if (!account) throw new Forbidden('Payments have not been set up for this store.');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) || /(localhost|\.local|\.internal)$/.test(domain)) throw new Forbidden('That domain cannot be registered.');
  const r = await d.connect.registerPaymentMethodDomain(account, domain); await d.reg.audit({ storeId, actor: 'system', action: 'payments.domain_registered', detail: domain }); return r;
}
