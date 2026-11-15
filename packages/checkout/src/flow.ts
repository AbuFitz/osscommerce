import { messageFor } from './errors.ts';
import type { Api, PaymentSession } from './operations.ts';

/** The browser-side payment sequence, with Stripe and the server injected so it can be tested without either.
 *  confirm() is Stripe.js `confirmPayment({ redirect: 'if_required' })`: 3D Secure is handled inside it. */
export type Phase = 'idle' | 'preparing' | 'ready' | 'confirming' | 'verifying' | 'complete' | 'failed' | 'unavailable';
export interface State { phase: Phase; session?: PaymentSession; error?: string; orderCode?: string; attempts: number }
export const initial: State = { phase: 'idle', attempts: 0 };

export type StripeResult = { error?: { code?: string; type?: string }; paymentIntent?: { id: string; status: string } };
export interface FlowDeps { api: Api; confirm(): Promise<StripeResult>; onState(s: State): void; sleep?(ms: number): Promise<void>; pollMs?: number; maxPolls?: number }

/** One flow per checkout page. A second submit while one is running returns the same promise, so a double click or a double tap cannot pay twice. */
export function createFlow(d: FlowDeps) {
  let state = initial, inflight: Promise<State> | null = null; const sleep = d.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  const set = (p: Partial<State>) => { state = { ...state, ...p }; d.onState(state); };
  return {
    get state() { return state; },
    async prepare() {
      if (state.phase === 'preparing' || state.phase === 'ready') return state;
      set({ phase: 'preparing', error: undefined });
      try { set({ phase: 'ready', session: await d.api.createSession() }); } catch { set({ phase: 'unavailable', error: 'Checkout is not available right now. Your basket is saved. Please try again shortly.' }); }
      return state;
    },
    pay(): Promise<State> {
      if (inflight) return inflight;
      if (state.phase !== 'ready' && state.phase !== 'failed') return Promise.resolve(state);
      inflight = (async () => {
        const session = state.session; if (!session) { set({ phase: 'failed', error: messageFor() }); return state; }
        set({ phase: 'confirming', error: undefined, attempts: state.attempts + 1 });
        const r = await d.confirm().catch(() => ({ error: { code: 'processing_error' } } as StripeResult));
        if (r.error) { set({ phase: 'failed', error: messageFor(r.error.code) }); return state; }
        const pi = r.paymentIntent; if (!pi) { set({ phase: 'failed', error: messageFor() }); return state; }
        if (pi.status === 'requires_payment_method') { set({ phase: 'failed', error: messageFor('card_declined') }); return state; }
        if (!['succeeded', 'processing', 'requires_capture'].includes(pi.status)) { set({ phase: 'failed', error: messageFor() }); return state; }
        // Never trust the browser's "succeeded". The server re-reads the payment from Stripe and checks order, amount, currency and fee before the order is placed.
        set({ phase: 'verifying' });
        for (let i = 0; i <= (d.maxPolls ?? 10); i++) {
          const done = await d.api.completeOrder(pi.id, session.orderCode).catch(() => null);
          if (done?.ok) { set({ phase: 'complete', orderCode: done.code }); return state; }
          if (pi.status !== 'processing') { set({ phase: 'failed', error: done ? 'We could not confirm your payment. If you were charged, contact the shop and quote your order number.' : messageFor() }); return state; }
          await sleep(d.pollMs ?? 2000);                        // asynchronous methods: wait for the bank, then try again
        }
        set({ phase: 'failed', error: 'Your payment is still being processed. We will email you when it is confirmed. Please do not pay again.' }); return state;
      })().finally(() => { inflight = null; });
      return inflight;
    },
  };
}
