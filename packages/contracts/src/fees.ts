/**
 * Payment costs as the merchant experiences them: one combined cost per payment (processor fee + platform fee) and the net they keep.
 * Rates are DATA, per payment category, never one universal number. Processor rates are Stripe's published UK standard pricing,
 * read from stripe.com/gb/pricing on the date below. They change, and Stripe may price a connected account differently, so
 * `PROCESSOR_RATES_CONFIRMED` stays false until Stripe confirms the arrangement in writing; surfaces must then label rates as indicative.
 */
export type PaymentCategory = 'uk_standard' | 'uk_premium' | 'eea' | 'international' | 'klarna';
export interface ProcessorRate { category: PaymentCategory; label: string; detail: string; bp: number; fixedMinor: number }
export interface RateCard { source: string; checkedOn: string; currency: 'GBP'; rates: ProcessorRate[]; currencyConversionBp: number; disputeFeeMinor: number; refundsReturnProcessingFee: boolean }

export const STRIPE_UK_RATE_CARD: RateCard = {
  source: 'https://stripe.com/gb/pricing', checkedOn: '2026-11-15', currency: 'GBP',
  rates: [
    { category: 'uk_standard', label: 'UK cards', detail: 'Standard UK debit and credit cards, including Apple Pay, Google Pay and Link', bp: 150, fixedMinor: 20 },
    { category: 'uk_premium', label: 'UK premium cards', detail: 'Corporate and premium rewards cards issued in the UK', bp: 280, fixedMinor: 20 },
    { category: 'eea', label: 'European cards', detail: 'Cards issued in the European Economic Area', bp: 250, fixedMinor: 20 },
    { category: 'international', label: 'International cards', detail: 'Cards issued outside the UK and EEA', bp: 315, fixedMinor: 20 },
    { category: 'klarna', label: 'Klarna', detail: 'Pay later and instalments. Starting rate; not enabled by default', bp: 499, fixedMinor: 35 },
  ],
  currencyConversionBp: 200, disputeFeeMinor: 2000, refundsReturnProcessingFee: false,
};
export const PROCESSOR_RATES_CONFIRMED = false;

const pct = (amountMinor: number, bp: number) => Math.round((amountMinor * bp) / 10000);
export const rateFor = (c: PaymentCategory, card: RateCard = STRIPE_UK_RATE_CARD) => { const r = card.rates.find(x => x.category === c); if (!r) throw new Error(`no rate for ${c}`); return r; };

export interface PaymentCost { grossMinor: number; processingMinor: number; conversionMinor: number; applicationMinor: number; totalFeeMinor: number; netMinor: number }
/** What one payment costs and what the merchant keeps. The platform fee is charged on the full amount, like the processor's percentage. */
export function paymentCost(a: { amountMinor: number; category: PaymentCategory; currencyConversion?: boolean; applicationFeeBp: number; card?: RateCard }): PaymentCost {
  const card = a.card ?? STRIPE_UK_RATE_CARD; const r = rateFor(a.category, card);
  const processingMinor = pct(a.amountMinor, r.bp) + r.fixedMinor;
  const conversionMinor = a.currencyConversion ? pct(a.amountMinor, card.currencyConversionBp) : 0;
  const applicationMinor = pct(a.amountMinor, a.applicationFeeBp);
  const totalFeeMinor = processingMinor + conversionMinor + applicationMinor;
  return { grossMinor: a.amountMinor, processingMinor, conversionMinor, applicationMinor, totalFeeMinor, netMinor: a.amountMinor - totalFeeMinor };
}
/** The combined headline rate for a category, e.g. 1.5% + 20p with a 0.5% platform fee is "2% + 20p". */
export function combinedRate(c: PaymentCategory, applicationFeeBp: number, card: RateCard = STRIPE_UK_RATE_CARD) {
  const r = rateFor(c, card); const bp = r.bp + applicationFeeBp;
  const p = (v: number) => `${(v / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  return { bp, fixedMinor: r.fixedMinor, text: `${p(bp)} + ${r.fixedMinor}p`, processorText: `${p(r.bp)} + ${r.fixedMinor}p`, platformText: p(applicationFeeBp) };
}
/**
 * What a refund does to the merchant's proceeds. The processor keeps its fee (Stripe standard pricing); our platform fee is
 * returned in proportion to the refunded amount when the plan says so (ADR 0002).
 */
export function refundEffect(a: { cost: PaymentCost; refundMinor: number; refundsReturnApplicationFee: boolean; card?: RateCard }) {
  const refund = Math.min(Math.max(a.refundMinor, 0), a.cost.grossMinor);
  const applicationReturnedMinor = a.refundsReturnApplicationFee && a.cost.grossMinor > 0 ? Math.floor((a.cost.applicationMinor * refund) / a.cost.grossMinor) : 0;
  const processingReturnedMinor = (a.card ?? STRIPE_UK_RATE_CARD).refundsReturnProcessingFee ? Math.floor(((a.cost.processingMinor + a.cost.conversionMinor) * refund) / a.cost.grossMinor) : 0;
  const feesKeptMinor = a.cost.totalFeeMinor - applicationReturnedMinor - processingReturnedMinor;
  return { refundMinor: refund, applicationReturnedMinor, processingReturnedMinor, feesKeptMinor, netAfterRefundMinor: a.cost.grossMinor - refund - feesKeptMinor };
}
