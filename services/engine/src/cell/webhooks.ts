import Stripe from 'stripe';

/** Connect webhook inbox. Verify signature on the raw body, accept only our connected account, de-duplicate on (account, event id),
 *  and apply state monotonically so out-of-order delivery cannot move an order backwards. */
export interface WebhookDeps {
  seen: { markIfNew(account: string, eventId: string): Promise<boolean> };
  orders: {
    byOrderCode(code: string): Promise<{ code: string; totalWithTaxMinor: number; currency: string; paymentState: PaymentState } | null>;
    setPaymentState(code: string, state: PaymentState, detail: string): Promise<void>;
    flagForReview(code: string, reason: string): Promise<void>;
  };
  checkout: { restrict(reason: string): Promise<void>; allow(): Promise<void> };
  account: string;
}
export type PaymentState = 'pending' | 'paid' | 'failed' | 'partially_refunded' | 'refunded' | 'disputed';
/** Higher rank wins. A late 'paid' can never overwrite 'refunded' or 'disputed'. */
const RANK: Record<PaymentState, number> = { pending: 0, failed: 1, paid: 2, partially_refunded: 3, refunded: 4, disputed: 5 };
export const advance = (cur: PaymentState, next: PaymentState): PaymentState => (RANK[next] > RANK[cur] ? next : cur);

export function verifySignature(stripe: Stripe, rawBody: string | Buffer, header: string, secret: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, header, secret);       // throws on a bad signature or a replay outside the tolerance window
}

export type Outcome = { status: 200 | 400; note: string };
export async function handleConnectEvent(e: { id: string; type: string; account?: string; created: number; data: { object: any } }, d: WebhookDeps): Promise<Outcome> {
  if (e.account !== d.account) return { status: 400, note: 'Event is for a different account' };            // never act on another merchant's event
  if (!(await d.seen.markIfNew(e.account, e.id))) return { status: 200, note: 'Duplicate ignored' };
  const o = e.data.object;
  const order = typeof o?.metadata?.orderCode === 'string' ? await d.orders.byOrderCode(o.metadata.orderCode) : null;
  switch (e.type) {
    case 'payment_intent.succeeded': {
      if (!order) return { status: 200, note: 'No matching order' };
      if (o.amount !== order.totalWithTaxMinor || String(o.currency).toLowerCase() !== order.currency.toLowerCase()) { await d.orders.flagForReview(order.code, 'Paid amount or currency differs from the order'); return { status: 200, note: 'Flagged: mismatch' }; }
      await d.orders.setPaymentState(order.code, advance(order.paymentState, 'paid'), 'Payment succeeded'); return { status: 200, note: 'Paid' };
    }
    case 'payment_intent.payment_failed': if (order) await d.orders.setPaymentState(order.code, advance(order.paymentState, 'failed'), 'Payment failed'); return { status: 200, note: 'Failed recorded' };
    case 'charge.refunded': {
      const code = o?.metadata?.orderCode ?? o?.payment_intent_metadata?.orderCode; const ord = order ?? (code ? await d.orders.byOrderCode(code) : null); if (!ord) return { status: 200, note: 'No matching order' };
      const full = o.amount_refunded >= o.amount; await d.orders.setPaymentState(ord.code, advance(ord.paymentState, full ? 'refunded' : 'partially_refunded'), `Refunded ${o.amount_refunded}`); return { status: 200, note: 'Refund recorded' };
    }
    case 'charge.dispute.created': { const code = o?.metadata?.orderCode; const ord = code ? await d.orders.byOrderCode(code) : null; if (ord) { await d.orders.setPaymentState(ord.code, advance(ord.paymentState, 'disputed'), 'Dispute opened'); await d.orders.flagForReview(ord.code, 'Dispute opened. Respond in Stripe before the deadline'); } return { status: 200, note: 'Dispute recorded' }; }
    case 'account.updated': {
      const ok = o?.charges_enabled === true && o?.requirements?.disabled_reason == null;
      if (ok) await d.checkout.allow(); else await d.checkout.restrict(String(o?.requirements?.disabled_reason ?? 'Charges are not enabled on this Stripe account'));
      return { status: 200, note: ok ? 'Checkout allowed' : 'Checkout restricted' };
    }
    default: return { status: 200, note: 'Ignored' };
  }
}
