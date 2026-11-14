import 'server-only';
import { GATE_COPY, LAUNCH_GATES, type CommerceGateway, type Customer, type Order, type Product, type Summary } from './gateway';
import { StoreId, OrganisationId } from '@oss-commerce/contracts';

/**
 * Deterministic synthetic fixtures (no real merchant data). Swap for HttpGateway
 * once a cell exists; keep this file out of production builds via OSS_DEMO.
 */
const AS_OF = '2026-11-14T09:00:00Z';
const P: Product[] = [
  { id: 'p1', title: 'Stoneware mug, speckled', status: 'published', sku: 'MUG-SPK', priceMinor: 1800, onHand: 42, allocated: 3, threshold: 10, variants: 3 },
  { id: 'p2', title: 'Linen apron', status: 'published', sku: 'APR-LIN', priceMinor: 3400, onHand: 6, allocated: 2, threshold: 8, variants: 2 },
  { id: 'p3', title: 'Serving bowl, large', status: 'published', sku: 'BWL-LRG', priceMinor: 4200, onHand: 3, allocated: 1, threshold: 5, variants: 1 },
  { id: 'p4', title: 'Tea towel set', status: 'published', sku: 'TWL-SET', priceMinor: 2200, onHand: 58, allocated: 0, threshold: 12, variants: 4 },
  { id: 'p5', title: 'Candle, fig and cedar', status: 'draft', sku: 'CND-FIG', priceMinor: 2600, onHand: 0, allocated: 0, threshold: 6, variants: 1 },
  { id: 'p6', title: 'Planter, glazed', status: 'published', sku: 'PLT-GLZ', priceMinor: 3800, onHand: 4, allocated: 0, threshold: 6, variants: 2 },
  { id: 'p7', title: 'Gift card', status: 'archived', sku: 'GFT-000', priceMinor: 5000, onHand: 0, allocated: 0, threshold: 0, variants: 1 },
];
const names = ['Maya Okafor', 'Tom Hendry', 'Priya Nair', 'Callum Reid', 'Elena Rossi', 'Sam Whitlock', 'Aisha Khan', 'Jonah Pike', 'Freya Lund', 'Noor Haddad', 'Ben Archer', 'Isla Murray'];
const mk = (i: number): Order => {
  const n = 1042 - i;
  const prod = P[i % 4];
  const qty = 1 + (i % 3);
  const sub = prod.priceMinor * qty;
  const ship = sub >= 5000 ? 0 : 495;
  const disc = i % 5 === 0 ? Math.round(sub * 0.1) : 0;
  const total = sub + ship - disc;
  const failed = i === 6;
  const refunded = i === 9 ? total : i === 4 ? 1800 : 0;
  const fulfilment = i < 3 ? 'unfulfilled' : i === 3 ? 'partial' : 'fulfilled';
  const d = new Date(Date.parse(AS_OF) - i * 3 * 3600_000 * (1 + (i % 4)));
  const iso = d.toISOString();
  const who = names[i % names.length];
  return {
    id: `o${n}`, number: n, placedAt: iso, customer: who, email: `${who.split(' ')[0].toLowerCase()}@example.com`,
    lines: [{ sku: prod.sku, title: prod.title, qty, unitMinor: prod.priceMinor }],
    shippingMinor: ship, discountMinor: disc, taxMinor: Math.round(total / 6), totalMinor: total,
    payment: failed ? 'failed' : refunded === total ? 'refunded' : refunded ? 'partially_refunded' : 'paid',
    fulfilment: failed ? 'unfulfilled' : fulfilment, state: failed || refunded === total ? 'cancelled' : fulfilment === 'fulfilled' ? 'completed' : 'open',
    refundedMinor: refunded, shipTo: `${12 + i} Mill Lane, Bristol BS${1 + (i % 9)} 4${'ABCDEFG'[i % 7]}${'XYZ'[i % 3]}`,
    timeline: [
      { at: iso, text: 'Order placed.' },
      { at: iso, text: failed ? 'Payment failed. No charge was made.' : 'Payment received.' },
      ...(fulfilment === 'fulfilled' && !failed ? [{ at: iso, text: 'Fulfilled with tracking.' }] : []),
      ...(refunded ? [{ at: iso, text: `Refund of £${(refunded / 100).toFixed(2)} confirmed.` }] : []),
    ],
  };
};
const ORDERS = Array.from({ length: 24 }, (_, i) => mk(i));
const CUSTOMERS: Customer[] = names.map((n, i) => ({ id: `c${i}`, name: n, email: `${n.split(' ')[0].toLowerCase()}@example.com`, orders: 1 + (i % 5), spentMinor: 2400 + i * 1850, lastOrder: ORDERS[i].placedAt, marketing: i % 3 !== 0 }));

export const demoGateway: CommerceGateway = {
  async store() {
    const done: Record<string, boolean> = { contract_signed: true, payments_enabled: true, domain_verified: false, test_order_passed: false, launch_approved: false };
    return {
      name: 'Kiln & Thread',
      store: { storeId: StoreId.parse('st_demo'), organisationId: OrganisationId.parse('org_demo'), cellId: 'cell-demo', hostnames: [{ host: 'kilnandthread.example', verified: false }], region: 'eu-west-london', lifecycle: 'configuring', entitlementVersion: 1, paymentReadiness: 'enabled' },
      readiness: LAUNCH_GATES.map(g => ({ gate: g, done: done[g], ...GATE_COPY[g] })),
    };
  },
  async summary(): Promise<Summary> {
    const paid = ORDERS.filter(o => o.payment !== 'failed');
    const gross = paid.reduce((s, o) => s + o.totalMinor, 0);
    const refunded = paid.reduce((s, o) => s + o.refundedMinor, 0);
    const day = (n: number) => new Date(Date.parse(AS_OF) - n * 86400_000).toISOString().slice(0, 10);
    const series = Array.from({ length: 14 }, (_, k) => {
      const d = day(13 - k);
      return { day: d, netMinor: paid.filter(o => o.placedAt.slice(0, 10) === d).reduce((s, o) => s + o.totalMinor - o.refundedMinor, 0) };
    });
    return {
      netMinor: gross - refunded, orders: paid.length, aovMinor: Math.round(gross / paid.length), refundedMinor: refunded,
      toFulfil: ORDERS.filter(o => o.state === 'open').length, lowStock: P.filter(p => p.status === 'published' && p.onHand - p.allocated <= p.threshold).length, series, asOf: AS_OF,
    };
  },
  async orders(q) {
    let r = ORDERS;
    if (q?.filter === 'unfulfilled') r = r.filter(o => o.state === 'open');
    if (q?.filter === 'attention') r = r.filter(o => o.payment === 'failed' || o.payment === 'disputed');
    if (q?.filter === 'refunded') r = r.filter(o => o.refundedMinor > 0);
    if (q?.q) { const s = q.q.toLowerCase(); r = r.filter(o => `${o.number} ${o.customer} ${o.email}`.toLowerCase().includes(s)); }
    return r;
  },
  async order(id) { return ORDERS.find(o => o.id === id) ?? null; },
  async products() { return P; },
  async customers() { return CUSTOMERS; },
};
