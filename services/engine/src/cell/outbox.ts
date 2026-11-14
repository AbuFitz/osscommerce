import { createHmac } from 'node:crypto';

/** Cell -> control plane events. Written to the cell's own outbox in the same database as the order, then delivered at-least-once.
 *  Delivery is signed per cell; the control plane de-duplicates on event id, so retrying is always safe. Critical emails therefore
 *  hang off commerce events recorded here, never off a browser action. */
export interface OutboxEvent { id: string; storeId: string; type: string; occurredAt: string; subject: Record<string, string>; recipient: { email?: string; name?: string }; consent: { marketing: boolean; capturedAt?: string; source?: string }; data: Record<string, unknown> }
export interface OutboxRow { event: OutboxEvent; attempts: number; nextAt: number; deliveredAt?: number }
export interface OutboxStore { add(e: OutboxEvent): Promise<void>; due(now: number, limit: number): Promise<OutboxRow[]>; markDelivered(ids: string[], now: number): Promise<void>; markFailed(ids: string[], nextAt: number): Promise<void> }

export const sign = (secret: string, body: string, now = Math.floor(Date.now() / 1000)) => `t=${now},v1=${createHmac('sha256', secret).update(`${now}.${body}`).digest('hex')}`;
const BACKOFF = [30, 120, 600, 3600, 21600];      // seconds; after the last, keep retrying every 6 hours and raise an alert (see deadLetterAfter)

/** Vendure order state -> domain event. Only states that matter to the buyer or merchant produce an event. */
export function fromOrderState(storeId: string, o: { id: string; code: string; totalWithTax: number; currencyCode: string; customer?: { emailAddress?: string; firstName?: string } | null }, to: string, eventSeq: string, now = new Date()): OutboxEvent | null {
  const type = ({ PaymentSettled: 'order.paid', Shipped: 'order.fulfilled', Cancelled: 'order.cancelled' } as Record<string, string>)[to];
  if (!type) return null;
  return { id: `${storeId}:${o.code}:${to}:${eventSeq}`.padEnd(8, '_'), storeId, type, occurredAt: now.toISOString(), subject: { orderId: o.code },
    recipient: { email: o.customer?.emailAddress, name: o.customer?.firstName }, consent: { marketing: false }, data: { totalMinor: o.totalWithTax, currency: o.currencyCode, orderCode: o.code } };
}

export interface DispatcherDeps { store: OutboxStore; cellId: string; secret: string; url: string; post(url: string, init: { body: string; headers: Record<string, string> }): Promise<{ status: number }>; now?: () => number; deadLetterAfter?: number; onAlert?: (msg: string) => void }
/** One flush: send due events in a batch. 2xx (including 207, where the control plane rejected individual invalid events) marks the batch delivered;
 *  anything else leaves it due with exponential backoff. A 4xx other than 429 is an alert, because retrying will not fix a bad credential. */
export async function flush(d: DispatcherDeps, limit = 25): Promise<{ sent: number; failed: number }> {
  const now = d.now ?? Date.now; const rows = await d.store.due(now(), limit); if (!rows.length) return { sent: 0, failed: 0 };
  const body = JSON.stringify({ cellId: d.cellId, events: rows.map(r => r.event) });
  let status = 0; try { status = (await d.post(d.url, { body, headers: { 'content-type': 'application/json', 'oss-signature': sign(d.secret, body, Math.floor(now() / 1000)) } })).status; } catch { status = 0; }
  const ids = rows.map(r => r.event.id);
  if (status >= 200 && status < 300) { await d.store.markDelivered(ids, now()); return { sent: rows.length, failed: 0 }; }
  const worst = Math.max(...rows.map(r => r.attempts)); const wait = BACKOFF[Math.min(worst, BACKOFF.length - 1)];
  await d.store.markFailed(ids, now() + wait * 1000);
  if (status >= 400 && status < 500 && status !== 429) d.onAlert?.(`Control plane rejected the cell's events (${status}). Check the cell credential.`);
  else if (worst + 1 >= (d.deadLetterAfter ?? 10)) d.onAlert?.(`Events have been undeliverable for ${worst + 1} attempts.`);
  return { sent: 0, failed: rows.length };
}

export class MemOutbox implements OutboxStore {
  rows = new Map<string, OutboxRow>();
  async add(e: OutboxEvent) { if (!this.rows.has(e.id)) this.rows.set(e.id, { event: e, attempts: 0, nextAt: 0 }); }     // same event twice is one row
  async due(now: number, limit: number) { return [...this.rows.values()].filter(r => !r.deliveredAt && r.nextAt <= now).slice(0, limit); }
  async markDelivered(ids: string[], now: number) { for (const i of ids) this.rows.get(i)!.deliveredAt = now; }
  async markFailed(ids: string[], nextAt: number) { for (const i of ids) { const r = this.rows.get(i)!; r.attempts++; r.nextAt = nextAt; } }
}
