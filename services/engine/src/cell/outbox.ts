import { createHmac, timingSafeEqual } from 'node:crypto';

/** Cell -> control plane events. Written to the cell's own outbox in the same database as the order, then delivered at-least-once.
 *  Delivery is signed per cell; the control plane de-duplicates on event id, so retrying is always safe. Critical emails therefore
 *  hang off commerce events recorded here, never off a browser action. */
export interface OutboxEvent { id: string; storeId: string; type: string; occurredAt: string; subject: Record<string, string>; recipient: { email?: string; name?: string }; consent: { marketing: boolean; capturedAt?: string; source?: string }; data: Record<string, unknown> }
export interface OutboxRow { event: OutboxEvent; attempts: number; nextAt: number; deliveredAt?: number }
export interface OutboxStore { add(e: OutboxEvent): Promise<void>; due(now: number, limit: number): Promise<OutboxRow[]>; markDelivered(ids: string[], now: number): Promise<void>; markFailed(ids: string[], nextAt: number): Promise<void> }

interface OrderSnapshot {
  code: string; total: number; totalWithTax: number; subTotalWithTax: number; shippingWithTax: number; currencyCode: string; orderPlacedAt?: Date | null;
  customer?: { emailAddress?: string; firstName?: string; lastName?: string } | null;
  shippingAddress?: { fullName?: string; company?: string; streetLine1?: string; streetLine2?: string; city?: string; province?: string; postalCode?: string; country?: string } | null;
  lines: { quantity: number; discountedUnitPriceWithTax: number; productVariant?: { name?: string } | null }[];
  fulfillments?: { state?: string; trackingCode?: string; method?: string }[];
}

export const sign = (secret: string, body: string, now = Math.floor(Date.now() / 1000)) => `t=${now},v1=${createHmac('sha256', secret).update(`${now}.${body}`).digest('hex')}`;
/** Same format as the platform's signer. Used to authenticate control-plane calls into the cell. */
export function verify(secret: string, body: string, header: string | null | undefined, now = Math.floor(Date.now() / 1000)): boolean {
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? ''); if (!m || Math.abs(now - Number(m[1])) > 300) return false;
  const want = createHmac('sha256', secret).update(`${m[1]}.${body}`).digest(), got = Buffer.from(m[2], 'hex'); return got.length === want.length && timingSafeEqual(got, want);
}
const BACKOFF = [30, 120, 600, 3600, 21600];      // seconds; after the last, keep retrying every 6 hours and raise an alert (see deadLetterAfter)

/** Vendure order state -> domain event. Only states that matter to the buyer or merchant produce an event. */
export function fromOrderState(storeId: string, o: OrderSnapshot, to: string, eventSeq: string, now = new Date()): OutboxEvent | null {
  const type = ({ PaymentSettled: 'order.paid', Shipped: 'order.fulfilled', Cancelled: 'order.cancelled' } as Record<string, string>)[to];
  if (!type) return null;
  const address = o.shippingAddress ? [o.shippingAddress.fullName, o.shippingAddress.company, o.shippingAddress.streetLine1, o.shippingAddress.streetLine2, o.shippingAddress.city, o.shippingAddress.province, o.shippingAddress.postalCode, o.shippingAddress.country].filter(Boolean).join(', ') : '';
  const customerName = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || o.shippingAddress?.fullName || '';
  const fulfillment = o.fulfillments?.find(f => f.state === 'Shipped') ?? o.fulfillments?.[0];
  return { id: `${storeId}:${o.code}:${to}:${eventSeq}`.padEnd(8, '_'), storeId, type, occurredAt: now.toISOString(), subject: { orderId: o.code },
    recipient: { email: o.customer?.emailAddress, name: customerName }, consent: { marketing: false }, data: {
      orderCode: o.code, placedAt: o.orderPlacedAt?.toISOString(), customerName,
      lines: o.lines.map(line => ({ title: line.productVariant?.name ?? '', quantity: line.quantity, unitMinor: line.discountedUnitPriceWithTax })),
      subtotalMinor: o.subTotalWithTax, shippingMinor: o.shippingWithTax, vatMinor: Math.max(0, o.totalWithTax - o.total),
      totalMinor: o.totalWithTax, currency: o.currencyCode, shipTo: address,
      ...(fulfillment?.trackingCode ? { trackingCode: fulfillment.trackingCode } : {}), ...(fulfillment?.method ? { carrier: fulfillment.method } : {}),
    } };
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
