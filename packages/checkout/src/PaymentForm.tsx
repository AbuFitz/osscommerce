'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
import { Elements, PaymentElement, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { createFlow, initial, type State } from './flow.ts';
import { appearance, type Brand } from './theme.ts';
import type { PaymentSession } from './operations.ts';

/** Shared payment step. Props are server-provided; the card fields are Stripe's iframes (card data never touches our code or the merchant's).
 *  Styling hooks: pass className / labels / children; the flow, wallets, 3D Secure and duplicate-submit protection stay the same for every storefront. */
export interface PaymentFormProps {
  createSession(): Promise<PaymentSession>; completeOrder(paymentIntentId: string, orderCode: string): Promise<{ ok: true; code: string; state: string } | { ok: false; message: string }>; orderState?(code: string): Promise<string | null>;
  returnUrl: string; brand: Brand; payLabel?: (amountMinor: number, currency: string) => string; onComplete(orderCode: string): void; className?: string; footer?: ReactNode;
}
const money = (m: number, c: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: c.toUpperCase() }).format(m / 100);

export function PaymentForm(p: PaymentFormProps) {
  const [session, setSession] = useState<PaymentSession | null>(null); const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { let live = true; p.createSession().then(s => { if (live) setSession(s); }).catch(() => live && setFailed('Checkout is not available right now. Your basket is saved. Please try again shortly.')); return () => { live = false; }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // Stripe.js is initialised for the MERCHANT's connected account, so the payment is created on their account and never on ours.
  const stripe = useMemo(() => (session ? loadStripe(session.publishableKey, { stripeAccount: session.stripeAccount }) : null), [session?.publishableKey, session?.stripeAccount]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (failed) return <p role="alert" className="oss-pay-error">{failed}</p>;
  if (!session || !stripe) return <div aria-busy="true" className={p.className}>Preparing secure payment…</div>;
  return <Elements stripe={stripe} options={{ clientSecret: session.clientSecret, appearance: appearance(p.brand) }}><Inner {...p} session={session} /></Elements>;
}

function Inner(p: PaymentFormProps & { session: PaymentSession }) {
  const stripe = useStripe(), elements = useElements(); const [st, setSt] = useState<State>({ ...initial, phase: 'ready', session: p.session });
  const ref = useRef<ReturnType<typeof createFlow>>(null as never);
  if (!ref.current) ref.current = createFlow({ api: { createSession: async () => p.session, completeOrder: p.completeOrder, orderState: p.orderState ?? (async () => null) }, onState: setSt,
    confirm: async () => { const r = await (stripe as Stripe).confirmPayment({ elements: elements as StripeElements, redirect: 'if_required', confirmParams: { return_url: p.returnUrl } }); return { error: r.error ? { code: r.error.code ?? r.error.decline_code ?? r.error.type } : undefined, paymentIntent: r.paymentIntent }; } });
  useEffect(() => { if (st.phase === 'complete' && st.orderCode) p.onComplete(st.orderCode); }, [st.phase, st.orderCode]);   // eslint-disable-line react-hooks/exhaustive-deps
  const busy = st.phase === 'confirming' || st.phase === 'verifying';
  return (<form className={p.className} onSubmit={e => { e.preventDefault(); if (stripe && elements) void ref.current.pay(); }} aria-busy={busy}>
    <ExpressCheckoutElement onConfirm={() => void ref.current.pay()} />
    <PaymentElement options={{ layout: 'accordion' }} />
    {st.error && <p role="alert" className="oss-pay-error">{st.error}</p>}
    <button type="submit" disabled={!stripe || !elements || busy || st.phase === 'complete'} className="oss-pay-button">{st.phase === 'verifying' ? 'Confirming…' : busy ? 'Processing…' : (p.payLabel ?? ((a, c) => `Pay ${money(a, c)}`))(p.session.amount, p.session.currency)}</button>
    {p.footer}
  </form>);
}
