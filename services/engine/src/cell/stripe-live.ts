import Stripe from 'stripe';
import type { PaymentIntentLite, StripePort } from './stripe-port.ts';

/** Real adapter. Direct charges: every call carries the connected account, so the charge lives on the merchant's own Stripe account. */
export function liveStripe(secretKey: string, override?: Stripe): StripePort {
  const s = override ?? new Stripe(secretKey);
  return {
    async createPaymentIntent(account, p) {
      const pi = await s.paymentIntents.create({ amount: p.amount, currency: p.currency, application_fee_amount: p.applicationFeeAmount, metadata: p.metadata, automatic_payment_methods: { enabled: true } }, { stripeAccount: account, idempotencyKey: p.idempotencyKey });
      if (!pi.client_secret) throw new Error('Stripe returned no client secret');
      return { id: pi.id, clientSecret: pi.client_secret };
    },
    async retrievePaymentIntent(account, id) { return (await s.paymentIntents.retrieve(id, {}, { stripeAccount: account })) as unknown as PaymentIntentLite; },
    async createRefund(account, p) {
      const r = await s.refunds.create({ payment_intent: p.paymentIntentId, amount: p.amount, refund_application_fee: p.refundApplicationFee, reason: (p.reason as 'requested_by_customer' | undefined) }, { stripeAccount: account, idempotencyKey: p.idempotencyKey });
      return { id: r.id, status: r.status ?? 'unknown' };
    },
  };
}
