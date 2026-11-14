import type { Component } from './connect.ts';

/** Pinned Stripe versions. The SDK's default API version must equal this; a test fails if an SDK upgrade moves it without a deliberate change here.
 *  Preview-only versions are not used in production. */
export const STRIPE_SDK_VERSION = '23.1.0';
export const STRIPE_API_VERSION = '2026-10-28.endive';

export interface NewMerchantAccount { storeId: string; email?: string; businessName: string; entityType: 'company' | 'individual'; businessUrl?: string; idempotencyKey: string }

/** The agreed configuration, as the exact Accounts v2 request: full Stripe Dashboard, Stripe collects fees and bears losses,
 *  merchant configuration with card payments requested, UK identity and GBP. Validated against Stripe's reference; to confirm in the
 *  sandbox and in writing: platform eligibility for Stripe-handled pricing, and that `card_payments` can be combined with `losses_collector: stripe`
 *  (Stripe lists the error `capability_not_available_for_loss_collector` for some capabilities). */
export function buildAccountRequest(a: NewMerchantAccount) {
  return {
    contact_email: a.email, display_name: a.businessName, dashboard: 'full' as const,
    identity: { country: 'gb', entity_type: a.entityType, business_details: { registered_name: a.businessName } },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
    defaults: { currency: 'gbp', locales: ['en-GB'], responsibilities: { fees_collector: 'stripe' as const, losses_collector: 'stripe' as const }, ...(a.businessUrl ? { profile: { business_url: a.businessUrl } } : {}) },
    metadata: { oss_store_id: a.storeId },
    include: ['configuration.merchant', 'defaults', 'identity', 'requirements'] as const,
  };
}

/** Components requested per Account Session, as the Stripe request body. Only allowlisted components can be built. */
export function sessionComponents(components: Component[]) {
  const on = (feature_flags?: Record<string, boolean>) => ({ enabled: true, ...(feature_flags ? { features: feature_flags } : {}) });
  const out: Record<string, unknown> = {};
  for (const c of components) {
    if (c === 'account_onboarding') out[c] = on(); else if (c === 'account_management') out[c] = on(); else if (c === 'notification_banner') out[c] = on();
    else if (c === 'payments') out[c] = on({ refund_management: true, dispute_management: true, capture_payments: false, destination_on_behalf_of_charge_management: false });
    else if (c === 'payouts') out[c] = on({ instant_payouts: false, edit_payout_schedule: true, standard_payouts: true });
    else out[c] = on();
  }
  return out;
}
