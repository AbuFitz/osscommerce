import express from 'express';
import type Stripe from 'stripe';
import { handleConnectEvent, verifySignature, type WebhookDeps } from './webhooks.ts';

/** Express middleware mounted before Vendure's body parsing so the raw bytes reach signature verification.
 *  Responses never echo internal detail: 400 for bad signature, 200 once handled (Stripe retries anything else). */
export function stripeWebhookMiddleware(o: { stripe: Stripe; secret: string; deps: WebhookDeps }) {
  const route = express.Router();
  route.post('/', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    let event: Stripe.Event;
    try { event = verifySignature(o.stripe, req.body, String(req.headers['stripe-signature'] ?? ''), o.secret); }
    catch { res.status(400).json({ error: 'invalid signature' }); return; }
    try {
      const r = await handleConnectEvent(event as any, o.deps);
      res.status(r.status).json({ ok: r.status === 200 });
    } catch { res.status(500).json({ error: 'retry' }); }     // not marked seen on failure paths that throw before commit; Stripe retries
  });
  return route;
}
export const WEBHOOK_PATH = '/webhooks/stripe';
