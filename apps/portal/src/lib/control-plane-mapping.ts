import type { AutomationRun, PaymentSetup } from './gateway';

export type ControlPlaneRow = Record<string, any>;

export function isRecentAuthentication(epochSeconds: number, now = Date.now()): boolean {
  return Number.isFinite(epochSeconds) && now / 1000 - epochSeconds >= 0 && now / 1000 - epochSeconds <= 600;
}

export function stripeOnboardingConfig(input: { secret?: string; appEnv?: string; publicUrl?: string; vercelProductionUrl?: string }): { secret: string; publicBaseUrl: string } | null {
  const secret = input.secret ?? '';
  const env = input.appEnv ?? 'development';
  const placeholder = /placeholder|change[-_]?me|replace|example|dummy|fake|todo/i.test(secret);
  const keyOk = !placeholder && (env === 'production' ? /^sk_live_[A-Za-z0-9]{16,}$/.test(secret) : /^sk_test_[A-Za-z0-9]{16,}$/.test(secret));
  const candidate = input.publicUrl ?? (input.vercelProductionUrl ? `https://${input.vercelProductionUrl}` : '');
  const publicBaseUrl = candidate.replace(/\/$/, '');
  return keyOk && /^https:\/\/[^/]+$/.test(publicBaseUrl) ? { secret, publicBaseUrl } : null;
}

export function grantTransition(current: string, decision: 'approve' | 'decline' | 'revoke', expiresAt: Date, now = new Date()): 'active' | 'declined' | 'revoked' | 'expired' | null {
  if (expiresAt.getTime() <= now.getTime()) return current === 'pending' || current === 'active' ? 'expired' : null;
  if (current === 'pending' && decision === 'approve') return 'active';
  if (current === 'pending' && decision === 'decline') return 'declined';
  if (current === 'active' && decision === 'revoke') return 'revoked';
  return null;
}

export function paymentView(row: ControlPlaneRow | undefined, applicationFeeBp: number): PaymentSetup {
  const empty = { chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [] as string[], pending: [] as string[] };
  if (!row) return { ...empty, status: 'not_started', headline: 'Set up payments', detail: 'Connect your bank account so customers can pay and you get paid directly.', applicationFeeBp };
  const saved = row.requirements && typeof row.requirements === 'object' ? row.requirements : {};
  const status = row.status as PaymentSetup['status'];
  const copy: Record<PaymentSetup['status'], [string, string]> = {
    unknown: ['Checking with Stripe', 'We could not read your payment status just now. Nothing has changed.'],
    not_started: ['Set up payments', 'Connect your bank account so customers can pay and you get paid directly.'],
    onboarding: ['Finish setting up payments', 'A few details are still needed before customers can pay.'],
    pending_verification: ['Stripe is verifying your details', 'Checkout turns on as soon as verification completes.'],
    action_required: ['Action needed to keep taking payments', 'Stripe needs more information. Complete it to keep checkout running.'],
    restricted: ['Payments are restricted', 'Stripe has limited this account. Review the notice in Stripe or contact support.'],
    enabled: ['Payments are on', 'Customers can pay and payouts go to your bank.'],
    payouts_paused: ['Payouts are paused', 'Customers can pay, but payouts to your bank are on hold.'],
    disconnected: ['Stripe is disconnected', 'Checkout is paused. Past orders and refunds stay available.'],
  };
  const known = !!copy[status];
  const [headline, detail] = copy[status] ?? copy.unknown;
  return {
    status: copy[status] ? status : 'unknown',
    headline: typeof saved.headline === 'string' ? saved.headline : headline,
    detail: typeof saved.detail === 'string' ? saved.detail : detail,
    chargesEnabled: known && row.charges_enabled === true,
    payoutsEnabled: known && row.payouts_enabled === true,
    checkoutAllowed: known && row.charges_enabled === true,
    actionRequired: typeof saved.actionRequired === 'boolean' ? saved.actionRequired : ['onboarding', 'action_required', 'restricted', 'payouts_paused', 'disconnected'].includes(status),
    due: Array.isArray(saved.due) ? saved.due.filter((x: unknown): x is string => typeof x === 'string') : [],
    pending: Array.isArray(saved.pending) ? saved.pending.filter((x: unknown): x is string => typeof x === 'string') : [],
    deadline: typeof saved.deadline === 'string' ? saved.deadline : undefined,
    account: typeof row.stripe_account_id === 'string' ? row.stripe_account_id : undefined,
    applicationFeeBp,
  };
}

export function automationOutcome(row: ControlPlaneRow): AutomationRun['outcome'] {
  if (row.status === 'sent') return 'sent';
  if (row.status === 'failed_retrying') return 'failed_retrying';
  if (row.status === 'failed') return 'failed';
  return row.skip_reason === 'no_consent' ? 'skipped_no_consent' : 'failed';
}
