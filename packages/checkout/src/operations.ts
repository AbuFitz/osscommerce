import type { createClient } from '@oss-commerce/storefront-sdk';
type Client = ReturnType<typeof createClient>;

/** The two server-authoritative operations the shared checkout needs. The browser never sends an amount, currency, fee or account. */
export const CREATE_PAYMENT_SESSION = `mutation CreatePaymentSession { createPaymentSession { clientSecret paymentIntentId publishableKey stripeAccount amount currency orderCode } }`;
export const ADD_PAYMENT = `mutation AddPayment($i: PaymentInput!) { addPaymentToOrder(input: $i) { __typename ... on Order { code state } ... on ErrorResult { message errorCode } } }`;
export const ORDER_BY_CODE = `query OrderByCode($c: String!) { orderByCode(code: $c) { code state } }`;

export interface PaymentSession { clientSecret: string; paymentIntentId: string; publishableKey: string; stripeAccount: string; amount: number; currency: string; orderCode: string }
export type Api = { createSession(): Promise<PaymentSession>; completeOrder(paymentIntentId: string, orderCode: string): Promise<{ ok: true; code: string; state: string } | { ok: false; message: string }>; orderState(code: string): Promise<string | null> };

/** Server-side adapter (Next route handlers / server actions) over the SDK client. `session` is the shopper's session token from their HttpOnly cookie. */
export function checkoutApi(client: Client, session: string): Api {
  return {
    async createSession() { return (await client.mutate<{ createPaymentSession: PaymentSession }>('CreatePaymentSession', CREATE_PAYMENT_SESSION, {}, { session })).data.createPaymentSession; },
    async completeOrder(paymentIntentId, orderCode) {
      const r = (await client.mutate<{ addPaymentToOrder: { __typename: string; code?: string; state?: string; message?: string } }>('AddPayment', ADD_PAYMENT, { i: { method: 'stripe-connect', metadata: { paymentIntentId } } }, { session, idempotencyKey: `pay:${orderCode}:${paymentIntentId}` })).data.addPaymentToOrder;
      return r.__typename === 'Order' ? { ok: true, code: r.code!, state: r.state! } : { ok: false, message: r.message ?? 'Payment could not be completed.' };
    },
    async orderState(code) { return (await client.query<{ orderByCode: { state: string } | null }>('OrderByCode', ORDER_BY_CODE, { c: code }, { session })).data.orderByCode?.state ?? null; },
  };
}
