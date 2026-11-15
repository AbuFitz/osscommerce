import { z } from 'zod';

/**
 * Commercial configuration as data. Pages, the portal and the billing integration read this; nothing hardcodes a price.
 * Seeded with the starting points from the product brief and treated as PROVISIONAL until costs and fees are validated.
 */
export const FeatureKey = z.enum([
  'advanced_reporting', 'automation_basic', 'automation_advanced', 'priority_support', 'staff_seats', 'inventory_locations', 'custom_checkout_branding',
]);
export type FeatureKey = z.infer<typeof FeatureKey>;

export const Entitlements = z.object({
  features: z.array(FeatureKey),
  limits: z.object({
    staffSeats: z.number().int().positive(),
    stockLocations: z.number().int().positive(),
    automationRunsPerMonth: z.number().int().nonnegative(),
    emailsPerMonth: z.number().int().nonnegative(),
    storageGb: z.number().positive(),
  }),
});
export type Entitlements = z.infer<typeof Entitlements>;

/** Transaction commission on captured payments, in basis points, optionally tiered by monthly volume (minor units, GBP). */
export const FeeSchedule = z.object({
  baseBp: z.number().int().min(0).max(1000),
  /** Decision (ADR 0002): when a payment is refunded, our fee on the refunded part is returned to the merchant. Default true. */
  refundsReturnFee: z.boolean().default(true),
  tiers: z.array(z.object({ fromMonthlyVolumeMinor: z.number().int().nonnegative(), bp: z.number().int().min(0).max(1000) })).default([]),
});
export type FeeSchedule = z.infer<typeof FeeSchedule>;

export const Plan = z.object({
  id: z.string(), name: z.string(), monthlyMinor: z.number().int().nonnegative(), buildFromMinor: z.number().int().nonnegative(),
  fee: FeeSchedule, entitlements: Entitlements, status: z.enum(['provisional', 'active', 'retired']),
});
export type Plan = z.infer<typeof Plan>;

export const Promotion = z.object({ id: z.string(), kind: z.enum(['percent_off_monthly', 'months_free', 'fee_bp_override']), value: z.number(), validFrom: z.string(), validTo: z.string() });
/** One merchant's actual terms: a plan plus any custom overrides and promotions, with effective dates for upgrades and downgrades. */
export const MerchantAgreement = z.object({
  storeId: z.string(), planId: z.string(), effectiveFrom: z.string(),
  overrides: z.object({ monthlyMinor: z.number().int().optional(), feeBp: z.number().int().optional(), entitlements: Entitlements.partial().optional() }).default({}),
  promotions: z.array(Promotion).default([]),
});
export type MerchantAgreement = z.infer<typeof MerchantAgreement>;

/**
 * One plan at launch (decision of 15 Nov 2026): £479 once for the storefront build, then £39 a month.
 * The fee machinery (basis points, tiers, overrides, promotions) stays so terms remain configurable per merchant.
 */
export const SEED_PLANS: Plan[] = [
  { id: 'commerce', name: 'OSS Commerce', monthlyMinor: 3900, buildFromMinor: 47900, status: 'provisional', fee: { baseBp: 50, refundsReturnFee: true, tiers: [] },
    entitlements: { features: ['automation_basic'], limits: { staffSeats: 3, stockLocations: 1, automationRunsPerMonth: 1000, emailsPerMonth: 5000, storageGb: 10 } } },
];
/**
 * What may be stated publicly. Anything false here must not appear as a firm customer-facing claim.
 * - applicationFee: the 0.5% platform fee was proposed earlier and has NOT been reconfirmed with the new pricing. Charged in code only when confirmed.
 * - vat: whether £39 and £479 include VAT is undecided (the company has no VAT number on record).
 */
export const COMMERCIAL_CONFIRMED = { monthly: true, build: true, applicationFee: false, vat: false, buildScope: false, supportAllowance: false } as const;
export const LAUNCH_PLAN = SEED_PLANS[0];

/** Resolve what a merchant actually pays and may use at a moment in time. Overrides beat the plan; an active fee promotion beats both. */
export function resolveAgreement(plan: Plan, a: MerchantAgreement, at: Date, monthlyVolumeMinor = 0) {
  const live = a.promotions.filter(p => new Date(p.validFrom) <= at && at <= new Date(p.validTo));
  const feeOverride = live.find(p => p.kind === 'fee_bp_override')?.value;
  const tier = [...plan.fee.tiers].sort((x, y) => y.fromMonthlyVolumeMinor - x.fromMonthlyVolumeMinor).find(t => monthlyVolumeMinor >= t.fromMonthlyVolumeMinor);
  const feeBp = feeOverride ?? a.overrides.feeBp ?? tier?.bp ?? plan.fee.baseBp;
  let monthly = a.overrides.monthlyMinor ?? plan.monthlyMinor;
  const pct = live.find(p => p.kind === 'percent_off_monthly')?.value; if (pct) monthly = Math.round(monthly * (1 - pct / 100));
  if (live.some(p => p.kind === 'months_free')) monthly = 0;
  const e = a.overrides.entitlements; const base = plan.entitlements;
  const entitlements: Entitlements = { features: e?.features ?? base.features, limits: { ...base.limits, ...(e?.limits ?? {}) } };
  return { monthlyMinor: monthly, feeBp, entitlements };
}
export const hasFeature = (e: Entitlements, f: FeatureKey) => e.features.includes(f);
export const feeMinor = (amountMinor: number, feeBp: number) => Math.round((amountMinor * feeBp) / 10000);

/** Fee returned on a refund. Proportional to the refunded share of the original charge, matching Stripe's own behaviour when the application fee is refunded. */
export function feeRefundMinor(args: { chargeMinor: number; feeMinor: number; refundMinor: number; refundsReturnFee: boolean }) {
  if (!args.refundsReturnFee || args.chargeMinor <= 0) return 0;
  const r = Math.min(Math.max(args.refundMinor, 0), args.chargeMinor);
  return Math.floor((args.feeMinor * r) / args.chargeMinor);
}
