/** Merchant payment readiness, derived from what Stripe says about the connected account, never from a redirect or a click.
 *  Charges and payouts are separate: a merchant can take payment before payouts are enabled, and the portal shows both. */
export interface StripeAccountLite {
  id: string; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean;
  requirements?: { currently_due?: string[]; eventually_due?: string[]; past_due?: string[]; pending_verification?: string[]; disabled_reason?: string | null; current_deadline?: number | null; errors?: { code: string; requirement: string; reason: string }[] };
  capabilities?: Record<string, 'active' | 'inactive' | 'pending' | 'unrequested' | string>;
}
export type PaymentStatus = 'not_started' | 'onboarding' | 'pending_verification' | 'action_required' | 'restricted' | 'enabled' | 'payouts_paused' | 'disconnected';
export interface PaymentReadiness {
  status: PaymentStatus; chargesEnabled: boolean; payoutsEnabled: boolean; checkoutAllowed: boolean;
  headline: string; detail: string; actionRequired: boolean; deadline?: string; due: string[]; pending: string[];
}

export function readiness(a: StripeAccountLite | null, opts: { disconnected?: boolean; now?: number } = {}): PaymentReadiness {
  const base = { chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [] as string[], pending: [] as string[] };
  if (opts.disconnected) return { ...base, status: 'disconnected', headline: 'Stripe is disconnected', detail: 'Checkout is paused. Past orders and refunds stay available. Reconnect to take payments again.', actionRequired: true };
  if (!a) return { ...base, status: 'not_started', headline: 'Set up payments', detail: 'Connect your bank account so customers can pay and you get paid directly.' };
  const r = a.requirements ?? {}; const due = [...new Set([...(r.past_due ?? []), ...(r.currently_due ?? [])])]; const pending = r.pending_verification ?? [];
  const deadline = r.current_deadline ? new Date(r.current_deadline * 1000).toISOString() : undefined;
  const common = { chargesEnabled: a.charges_enabled, payoutsEnabled: a.payouts_enabled, due, pending, deadline };
  if (!a.details_submitted) return { ...base, ...common, status: 'onboarding', headline: 'Finish setting up payments', detail: 'A few details are still needed before customers can pay.', actionRequired: true };
  if (r.disabled_reason && !a.charges_enabled) {
    const rejected = /^rejected/.test(r.disabled_reason);
    if (rejected) return { ...base, ...common, status: 'restricted', headline: 'Payments are not available', detail: 'Stripe has declined this account. Contact support so we can help with next steps.', actionRequired: true };
    if (r.disabled_reason === 'requirements.pending_verification') return { ...base, ...common, status: 'pending_verification', headline: 'Stripe is verifying your details', detail: 'This usually takes a short while. We will email you if anything else is needed.' };
    return { ...base, ...common, status: due.length ? 'action_required' : 'restricted', headline: due.length ? 'Action needed to keep taking payments' : 'Payments are restricted', detail: due.length ? 'Stripe needs more information. Complete it to restore checkout.' : 'Stripe has limited this account. Review the notice in Stripe or contact support.', actionRequired: true };
  }
  if (a.charges_enabled && due.length) return { ...base, ...common, status: 'action_required', checkoutAllowed: true, headline: 'Action needed soon', detail: deadline ? 'Provide the missing details before the deadline to avoid interruption.' : 'Stripe needs more information to keep payments running.', actionRequired: true };
  if (a.charges_enabled && !a.payouts_enabled) return { ...base, ...common, status: 'payouts_paused', checkoutAllowed: true, headline: 'Payouts are paused', detail: 'Customers can pay, but payouts to your bank are on hold. Check your bank details.', actionRequired: true };
  if (a.charges_enabled && pending.length) return { ...base, ...common, status: 'enabled', checkoutAllowed: true, headline: 'Payments are on', detail: 'Stripe is still checking some details in the background.' };
  if (a.charges_enabled) return { ...base, ...common, status: 'enabled', checkoutAllowed: true, headline: 'Payments are on', detail: 'Customers can pay and payouts go to your bank.' };
  return { ...base, ...common, status: 'pending_verification', headline: 'Stripe is verifying your details', detail: 'Checkout turns on as soon as verification completes.' };
}

/** Checkout switches off whenever charges are not enabled. Existing orders, refunds and reconciliation are unaffected. */
export const checkoutAllowed = (a: StripeAccountLite | null, disconnected = false) => readiness(a, { disconnected }).checkoutAllowed;
