import { feeMinor, feeRefundMinor } from '@oss-commerce/contracts';
import type { StripePort } from './stripe-port.ts';

export interface PaymentsDeps { stripe: StripePort; account: string; feeBp: number; refundsReturnFee: boolean }
export class PaymentError extends Error {}

/** Charge creation. Amount, currency and fee are computed on the server from the authoritative order; nothing comes from the client. */
export async function createPaymentIntentForOrder(d: PaymentsDeps, order: { code: string; totalWithTaxMinor: number; currency: string; id: string }) {
  if (order.totalWithTaxMinor < 30) throw new PaymentError('Order total is below the minimum card payment.');
  const fee = feeMinor(order.totalWithTaxMinor, d.feeBp);
  if (fee >= order.totalWithTaxMinor) throw new PaymentError('Application fee must be less than the charge.');
  return d.stripe.createPaymentIntent(d.account, {
    amount: order.totalWithTaxMinor, currency: order.currency.toLowerCase(), applicationFeeAmount: fee,
    metadata: { orderCode: order.code, orderId: order.id }, idempotencyKey: `pi:${order.code}:${order.totalWithTaxMinor}`,   // changes if the basket changes, never duplicates for the same basket
  });
}

/** Called when the shopper returns from checkout. Never trusts the client: re-reads the PaymentIntent from Stripe and checks it matches the order. */
export async function verifyPayment(d: PaymentsDeps, order: { code: string; totalWithTaxMinor: number; currency: string }, paymentIntentId: string) {
  const pi = await d.stripe.retrievePaymentIntent(d.account, paymentIntentId);
  if (pi.metadata.orderCode !== order.code) throw new PaymentError('Payment does not belong to this order.');
  if (pi.currency.toLowerCase() !== order.currency.toLowerCase()) throw new PaymentError('Payment currency does not match the order.');
  if (pi.amount !== order.totalWithTaxMinor) throw new PaymentError('Payment amount does not match the order total. Flagged for review.');
  if (pi.application_fee_amount !== feeMinor(order.totalWithTaxMinor, d.feeBp)) throw new PaymentError('Application fee does not match the agreement. Flagged for review.');
  if (pi.status === 'succeeded') return { state: 'Settled' as const, transactionId: pi.id };
  if (pi.status === 'processing' || pi.status === 'requires_capture') return { state: 'Authorized' as const, transactionId: pi.id };
  throw new PaymentError(`Payment is ${pi.status}.`);
}

/** Refund. Our fee on the refunded part is returned by default (ADR 0002). Idempotent per (payment, amount, refund id). */
export async function refundPayment(d: PaymentsDeps, p: { paymentIntentId: string; chargeMinor: number; refundMinor: number; refundId: string; reason?: string }) {
  const fee = feeMinor(p.chargeMinor, d.feeBp);
  const returned = feeRefundMinor({ chargeMinor: p.chargeMinor, feeMinor: fee, refundMinor: p.refundMinor, refundsReturnFee: d.refundsReturnFee });
  const r = await d.stripe.createRefund(d.account, { paymentIntentId: p.paymentIntentId, amount: p.refundMinor, refundApplicationFee: d.refundsReturnFee, idempotencyKey: `refund:${p.refundId}`, reason: p.reason });
  return { stripeRefundId: r.id, status: r.status, feeReturnedMinor: returned };
}
