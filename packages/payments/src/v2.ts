import { readiness, type PaymentReadiness, type StripeAccountLite } from './account-state.ts';

/** Accounts v2 represents readiness differently from v1: there is no `charges_enabled`, `payouts_enabled` or `details_submitted`.
 *  Capabilities live under configurations (`merchant.capabilities.card_payments`, `merchant.capabilities.stripe_balance.payouts`) with a
 *  status and status_details, and requirements are `entries`. Fields that were not requested through `include` come back null, which is NOT
 *  the same as disabled. Read from the documented shape in the pinned SDK (stripe 23.1.0, API 2026-10-28.endive). */
type CapStatus = 'active' | 'pending' | 'rejected' | 'restricted' | 'unsupported' | string;
interface Cap { status: CapStatus; status_details?: { code: string; resolution?: 'contact_stripe' | 'no_resolution' | 'provide_info' | string }[] }
interface Entry { description: string; awaiting_action_from: 'stripe' | 'user'; minimum_deadline?: { status?: string; time?: string } | null; errors?: { code: string; description: string }[]; impact?: { restricts_capabilities?: unknown[] } }
export interface V2Account {
  id: string; object?: 'v2.core.account'; closed?: boolean | null; dashboard?: 'express' | 'full' | 'none' | null;
  configuration?: { merchant?: { applied?: boolean; capabilities?: { card_payments?: Cap | null; stripe_balance?: { payouts?: Cap | null } | null } | null } | null } | null;
  requirements?: { entries?: Entry[]; summary?: { minimum_deadline?: { status?: string; time?: string } | null } | null } | null;
  defaults?: { currency?: string | null; responsibilities?: { fees_collector?: string | null; losses_collector?: string | null; requirements_collector?: string | null } | null } | null;
}
/** What every v2 read must ask for. Without it fields are null and an account could be misread. */
export const V2_INCLUDE = ['configuration.merchant', 'requirements', 'defaults'] as const;

export type RetrievedAccount = { kind: 'v1'; account: StripeAccountLite } | { kind: 'v2'; account: V2Account };
export const readinessOf = (r: RetrievedAccount, o: { disconnected?: boolean } = {}): PaymentReadiness => (r.kind === 'v1' ? readiness(r.account, o) : readinessFromV2(r.account, o));

export function readinessFromV2(a: V2Account, o: { disconnected?: boolean } = {}): PaymentReadiness {
  const none = { chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [] as string[], pending: [] as string[] };
  if (o.disconnected || a.closed) return { ...none, status: 'disconnected', headline: 'Stripe is disconnected', detail: 'Checkout is paused. Past orders and refunds stay available. Reconnect to take payments again.', actionRequired: true };
  const m = a.configuration?.merchant;
  // Not requested, or not returned: we do not know. Never treat absence as "disabled" (that would switch off a working shop).
  if (m === undefined || m === null || !m.capabilities) return { ...none, status: m === null || m === undefined ? 'unknown' : 'onboarding', headline: 'Checking with Stripe', detail: 'We could not read your payment status just now. Nothing has changed.' };
  if (m.applied === false) return { ...none, status: 'not_started', headline: 'Set up payments', detail: 'Connect your bank account so customers can pay and you get paid directly.' };
  const card = m.capabilities.card_payments?.status, pay = m.capabilities.stripe_balance?.payouts?.status;
  const entries = a.requirements?.entries ?? [];
  const due = entries.filter(e => e.awaiting_action_from === 'user').map(e => e.description);
  const pending = entries.filter(e => e.awaiting_action_from === 'stripe').map(e => e.description);
  const t = a.requirements?.summary?.minimum_deadline?.time ?? entries.map(e => e.minimum_deadline?.time).filter(Boolean).sort()[0];
  const deadline = t ? new Date(t).toISOString() : undefined;
  const codes = [...(m.capabilities.card_payments?.status_details ?? []), ...(m.capabilities.stripe_balance?.payouts?.status_details ?? [])].map(d => d.code);
  const charges = card === 'active', payouts = pay === 'active';
  const common = { chargesEnabled: charges, payoutsEnabled: payouts, due, pending, deadline };
  if (card === 'rejected' || card === 'unsupported' || codes.some(c => /^(rejected_|unsupported_)/.test(c))) return { ...none, ...common, status: 'restricted', headline: 'Payments are not available', detail: 'Stripe has declined this account. Contact support so we can help with next steps.', actionRequired: true };
  if (charges) {
    if (due.length) return { ...none, ...common, status: 'action_required', checkoutAllowed: true, headline: 'Action needed soon', detail: deadline ? 'Provide the missing details before the deadline to avoid interruption.' : 'Stripe needs more information to keep payments running.', actionRequired: true };
    if (!payouts && pay !== undefined && pay !== 'pending') return { ...none, ...common, status: 'payouts_paused', checkoutAllowed: true, headline: 'Payouts are paused', detail: 'Customers can pay, but payouts to your bank are on hold. Check your bank details.', actionRequired: true };
    return { ...none, ...common, status: 'enabled', checkoutAllowed: true, headline: 'Payments are on', detail: pending.length ? 'Stripe is still checking some details in the background.' : payouts ? 'Customers can pay and payouts go to your bank.' : 'Customers can pay. Payouts will switch on once Stripe finishes checking your bank details.' };
  }
  if (card === 'restricted') return due.length || codes.includes('requirements_past_due') ? { ...none, ...common, status: 'action_required', headline: 'Action needed to keep taking payments', detail: 'Stripe needs more information. Complete it to restore checkout.', actionRequired: true } : { ...none, ...common, status: 'restricted', headline: 'Payments are restricted', detail: 'Stripe has limited this account. Review the notice in Stripe or contact support.', actionRequired: true };
  if (due.length) return { ...none, ...common, status: 'onboarding', headline: 'Finish setting up payments', detail: 'A few details are still needed before customers can pay.', actionRequired: true };
  return { ...none, ...common, status: 'pending_verification', headline: 'Stripe is verifying your details', detail: 'Checkout turns on as soon as verification completes.' };
}
