import express from 'express';
import { z } from 'zod';
import { verify } from './outbox.ts';
import type { CheckoutGate, CheckoutGateSource } from './plugin.ts';

export const CONTROL_PATH = '/control/checkout';
const Body = z.object({ allowed: z.boolean(), reason: z.string().max(200).optional(), sequence: z.number().int().nonnegative(), source: z.enum(['payments', 'merchant']).default('payments') });

/** Control plane -> cell: switch one checkout restriction source on or off. Signed, replay-limited, and ordered per source so a late
 *  "allowed" cannot undo a newer "blocked", while merchant and payment restrictions remain independent. */
export function controlMiddleware(o: { secret: string; gate: CheckoutGate }) {
  const last: Record<CheckoutGateSource, number> = { payments: -1, merchant: -1 }; const r = express.Router();
  r.post('/', express.raw({ type: 'application/json', limit: '8kb' }), async (req, res) => {
    const raw = req.body.toString('utf8');
    if (!verify(o.secret, raw, String(req.headers['oss-signature'] ?? ''))) { res.status(401).json({ error: 'unauthorized' }); return; }
    const b = Body.safeParse(JSON.parse(raw || '{}')); if (!b.success) { res.status(400).json({ error: 'invalid' }); return; }
    if (b.data.sequence < last[b.data.source]) { res.status(200).json({ stale: true }); return; }
    last[b.data.source] = b.data.sequence; await o.gate.set(b.data.allowed, b.data.reason, b.data.source); res.status(200).json({ ok: true });
  });
  return r;
}
