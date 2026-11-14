import express from 'express';
import { z } from 'zod';
import { verify } from './outbox.ts';
import type { CheckoutGate } from './plugin.ts';

export const CONTROL_PATH = '/control/checkout';
const Body = z.object({ allowed: z.boolean(), reason: z.string().max(200).optional(), sequence: z.number().int().nonnegative() });

/** Control plane -> cell: switch checkout on or off when the merchant's Stripe account state changes. Signed, replay-limited, and ordered by
 *  sequence so a late "allowed" cannot undo a newer "blocked". */
export function controlMiddleware(o: { secret: string; gate: CheckoutGate }) {
  let last = -1; const r = express.Router();
  r.post('/', express.raw({ type: 'application/json', limit: '8kb' }), async (req, res) => {
    const raw = req.body.toString('utf8');
    if (!verify(o.secret, raw, String(req.headers['oss-signature'] ?? ''))) { res.status(401).json({ error: 'unauthorized' }); return; }
    const b = Body.safeParse(JSON.parse(raw || '{}')); if (!b.success) { res.status(400).json({ error: 'invalid' }); return; }
    if (b.data.sequence < last) { res.status(200).json({ stale: true }); return; }
    last = b.data.sequence; await o.gate.set(b.data.allowed, b.data.reason); res.status(200).json({ ok: true });
  });
  return r;
}
