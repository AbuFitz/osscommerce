import Stripe from 'stripe';
import { buildAccountRequest, sessionComponents, STRIPE_API_VERSION } from './accounts.ts';
import { V2_INCLUDE, type V2Account, type RetrievedAccount } from './v2.ts';
import type { ConnectPort } from './connect.ts';
import type { StripeAccountLite } from './account-state.ts';

/** Stripe adapter for the platform (control plane) side. The key is a platform secret: it exists only in this process. */
export function liveConnect(secretKey: string, stripeOverride?: Stripe): ConnectPort {
  const s = stripeOverride ?? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION as any });
  return {
    async createAccount(p) {
      const a = await (s as any).v2.core.accounts.create(buildAccountRequest(p), { idempotencyKey: p.idempotencyKey });
      return { id: a.id as string };
    },
    async createAccountSession({ account, components }) {
      const r = await s.accountSessions.create({ account, components: sessionComponents(components) as any });
      return { clientSecret: r.client_secret, expiresAt: r.expires_at };
    },
    /** Hosted onboarding, used as the fallback when embedded components are unavailable. */
    async createAccountLink({ account, returnUrl, refreshUrl }) {
      const r = await (s as any).v2.core.accountLinks.create({ account, use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant'], refresh_url: refreshUrl, return_url: returnUrl } } });
      return { url: r.url as string };
    },
    /** v2 first; an account that is not a v2 account (connected through OAuth) answers with a specific error and is read as v1. */
    async retrieveAccount(account): Promise<RetrievedAccount> {
      try { return { kind: 'v2', account: (await (s as any).v2.core.accounts.retrieve(account, { include: [...V2_INCLUDE] })) as V2Account }; }
      catch (e: any) {
        if (e?.code === 'account_not_yet_compatible_with_v2' || e?.code === 'v1_account_instead_of_v2_account' || /v1/i.test(String(e?.message))) return { kind: 'v1', account: (await s.accounts.retrieve(account)) as unknown as StripeAccountLite };
        throw e;
      }
    },
    async registerPaymentMethodDomain(account, domain) {
      const d = await s.paymentMethodDomains.create({ domain_name: domain }, { stripeAccount: account });
      return { id: d.id, enabled: d.enabled, applePay: d.apple_pay?.status === 'active', googlePay: d.google_pay?.status === 'active', link: d.link?.status === 'active' };
    },
  };
}
