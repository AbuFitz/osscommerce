import { PaymentMethodHandler, LanguageCode } from '@vendure/core';
import { createPaymentIntentForOrder, verifyPayment, refundPayment, PaymentError, type PaymentsDeps } from './connect-payments.ts';

/** Vendure payment method handler for Stripe Connect direct charges. Registered by the cell at bootstrap with the cell's own deps.
 *  Shopper flow: shop API calls addPaymentToOrder with metadata.paymentIntentId after Stripe confirms on the client. We never trust that:
 *  verifyPayment re-reads the intent from Stripe and checks order, amount, currency and our fee. */
export function connectHandler(deps: PaymentsDeps) {
  return new PaymentMethodHandler({
    code: 'stripe-connect', description: [{ languageCode: LanguageCode.en, value: 'Card payments (Stripe Connect)' }], args: {},
    async createPayment(_ctx, order, amount, _args, metadata) {
      try {
        const intentId = String((metadata as any)?.paymentIntentId ?? '');
        if (!intentId) throw new PaymentError('Missing payment reference.');
        const v = await verifyPayment(deps, { code: order.code, totalWithTaxMinor: order.totalWithTax, currency: order.currencyCode }, intentId);
        if (amount !== order.totalWithTax) throw new PaymentError('Payment amount does not match the order total.');
        return { amount, state: v.state, transactionId: v.transactionId, metadata: { paymentIntentId: intentId } };
      } catch (e) {
        if (e instanceof PaymentError) return { amount, state: 'Declined' as const, errorMessage: e.message };
        throw e;
      }
    },
    settlePayment: async () => ({ success: true }),
    async createRefund(_ctx, input, amount, order, payment) {
      const r = await refundPayment(deps, { paymentIntentId: payment.transactionId, chargeMinor: payment.amount, refundMinor: amount, refundId: `${order.code}:${payment.id}:${input.reason ?? ''}:${amount}` });
      return { state: r.status === 'succeeded' || r.status === 'pending' ? 'Settled' as const : 'Failed' as const, transactionId: r.stripeRefundId, metadata: { feeReturnedMinor: r.feeReturnedMinor } };
    },
  });
}

export { createPaymentIntentForOrder };
