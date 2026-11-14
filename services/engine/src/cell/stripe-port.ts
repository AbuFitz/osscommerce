/** The only Stripe surface the cell uses. A narrow port, so payments logic is testable without the network. */
export interface PaymentIntentLite { id: string; status: string; amount: number; amount_received?: number; currency: string; metadata: Record<string, string>; application_fee_amount: number | null; latest_charge?: string | null }
export interface StripePort {
  createPaymentIntent(account: string, p: { amount: number; currency: string; applicationFeeAmount: number; metadata: Record<string, string>; idempotencyKey: string }): Promise<{ id: string; clientSecret: string }>;
  retrievePaymentIntent(account: string, id: string): Promise<PaymentIntentLite>;
  createRefund(account: string, p: { paymentIntentId: string; amount: number; refundApplicationFee: boolean; idempotencyKey: string; reason?: string }): Promise<{ id: string; status: string }>;
}
