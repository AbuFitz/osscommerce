import 'server-only';
import { cookies } from 'next/headers';
import { LAUNCH_PLAN } from '@oss-commerce/contracts';
import { orderPoints, recentOrders } from './geo/points';
import { splitRegions, validateRate } from './delivery';
import { GATE_COPY, LAUNCH_GATES, ROLE_INFO, type ActivityEntry, type Notice, type LiveView, type Billing, type OptionGroup, type Variant, type VariantInput, type Collection, type ProductDetail, type Discount, type Automation, type ShippingZone, type Member, type AccessGrant, type ServiceRequest, type CommerceGateway, type Customer, type Order, type Product, type Summary, type PaymentSetup, type StartPaymentSetup } from './gateway';
import { StoreId, OrganisationId, feeMinor, feeRefundMinor, validateDraft } from '@oss-commerce/contracts';
import { statusOf, validateDiscount } from './discounts';
import { DEFAULT_LOW_AT, appendLog, parseLog, planAdjust, planCount, stockStatus, type LogEntry } from './stock';

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
/** Where demo customers live: mostly the UK, some further afield, so the live map has something to show. */
const WHERE: [string, string][] = [['Bristol','GB'],['London','GB'],['London','GB'],['Bath','GB'],['Glasgow','GB'],['Cardiff','GB'],['Manchester','GB'],['Leeds','GB'],['Edinburgh','GB'],['Brighton','GB'],['Dublin','IE'],['Paris','FR'],['Berlin','DE'],['Amsterdam','NL'],['New York City','US'],['Toronto','CA'],['Sydney','AU'],['Tokyo','JP']];
const whereOf = (i: number) => { const [city, country] = WHERE[(i * 5 + 3) % WHERE.length]; return { city, country }; };
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
    method: ([{ brand: 'visa', last4: '4242' }, { brand: 'mastercard', last4: '4444', wallet: 'applepay' }, { brand: 'visa', last4: '0005', wallet: 'googlepay' }, { brand: 'amex', last4: '1005' }, { brand: 'mastercard', last4: '5100' }] as const)[i % 5],
    refundedMinor: refunded, shipTo: `${12 + i} Mill Lane, ${whereOf(i).city}`, ship: whereOf(i),
    timeline: [
      { at: iso, text: 'Order placed.' },
      { at: iso, text: failed ? 'Payment failed. No charge was made.' : 'Payment received.' },
      ...(fulfilment === 'fulfilled' && !failed ? [{ at: iso, text: 'Fulfilled with tracking.' }] : []),
      ...(refunded ? [{ at: iso, text: `Refund of £${(refunded / 100).toFixed(2)} confirmed.` }] : []),
    ],
  };
};
const ORDERS = Array.from({ length: 24 }, (_, i) => mk(i));
/** Older, deterministic history so longer report ranges have something real to draw. Same shape as the recent orders; nothing here is random. */
const HISTORY: Order[] = (() => {
  const out: Order[] = []; let n = 1000;
  for (let back = 15; back <= 120; back++) {
    const d = new Date(Date.parse(AS_OF) - back * 86400_000); const wd = d.getUTCDay();
    const base = (wd === 0 || wd === 6) ? 2 : 1; const growth = 1 + (120 - back) / 120;       // busier at weekends, and growing
    const count = Math.round(((back * 7 + wd * 3) % 5 === 0 ? 0 : base) * growth * (1 + ((back * 13) % 3) / 2));
    for (let k = 0; k < count; k++) {
      const i = back * 5 + k; const prod = P[i % 4]; const qty = 1 + (i % 3); const sub = prod.priceMinor * qty; const ship = sub >= 5000 ? 0 : 495; const disc = i % 7 === 0 ? Math.round(sub * 0.1) : 0; const total = sub + ship - disc;
      const iso = new Date(d.getTime() + (8 + ((i * 3) % 12)) * 3600_000).toISOString(); const who = names[(i * 7) % names.length]; const refunded = i % 23 === 0 ? Math.round(total / 2) : 0;
      out.push({ id: `h${n}`, number: n--, placedAt: iso, customer: who, email: `${who.split(' ')[0].toLowerCase()}@example.com`, lines: [{ sku: prod.sku, title: prod.title, qty, unitMinor: prod.priceMinor }], shippingMinor: ship, discountMinor: disc, taxMinor: Math.round(total / 6), totalMinor: total,
        payment: refunded ? 'partially_refunded' : 'paid', fulfilment: 'fulfilled', state: 'completed', refundedMinor: refunded, shipTo: '', ship: whereOf(i), timeline: [{ at: iso, text: 'Order placed.' }],
        method: ([{ brand: 'visa', last4: '4242' }, { brand: 'mastercard', last4: '4444', wallet: 'applepay' }, { brand: 'visa', last4: '0005', wallet: 'googlepay' }, { brand: 'amex', last4: '1005' }] as const)[i % 4] });
    }
  }
  return out;
})();

const CUSTOMERS: Customer[] = names.map((n, i) => ({ id: `c${i}`, name: n, email: `${n.split(' ')[0].toLowerCase()}@example.com`, orders: 1 + (i % 5), spentMinor: 2400 + i * 1850, lastOrder: ORDERS[i].placedAt, marketing: i % 3 !== 0 }));


const DISCOUNTS: Discount[] = [
      { id: 'd1', code: 'WELCOME10', name: 'Welcome 10%', kind: 'percent', value: 10, status: 'active', used: 14, limit: 200, perCustomer: 1, window: 'No end date' },
      { id: 'd2', code: 'FREESHIP50', name: 'Free delivery over £50', kind: 'shipping', value: 0, status: 'active', used: 31, window: 'Ends 31 Dec 2026', endsAt: '2026-12-31T23:59:59.999Z', minSpendMinor: 5000 },
      { id: 'd3', code: 'BLACKFRIDAY', name: 'Black Friday', kind: 'percent', value: 20, status: 'scheduled', used: 0, limit: 500, window: 'Starts 27 Nov 2026, ends 30 Nov 2026', startsAt: '2026-11-27T00:00:00.000Z', endsAt: '2026-11-30T23:59:59.999Z' },
      { id: 'd4', code: 'SUMMER5', name: 'Summer £5 off', kind: 'fixed', value: 500, status: 'expired', used: 88, limit: 100, window: 'Ended 31 Aug 2026', endsAt: '2026-08-31T23:59:59.999Z' },
      { id: 'd5', code: '', automatic: true, name: 'Tea towels, 3 for 2', kind: 'bogo', value: 0, buy: 2, get: 1, productIds: ['p4'], status: 'active', used: 9, window: 'No end date' },
      { id: 'd6', code: 'LINEN15', name: 'Linen 15%', kind: 'percent', value: 15, productIds: ['p2'], status: 'paused', used: 3, window: 'No end date' },
    ];
const ZONES: ShippingZone[] = [
        { name: 'United Kingdom', regions: 'England, Scotland, Wales, Northern Ireland', rates: [{ label: 'Standard, 2–4 days', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Light parcel, 3–5 days', priceMinor: 295, when: { maxWeightGrams: 1000 } }, { label: 'Next day', priceMinor: 795 }, { label: 'Large items', priceMinor: 0, bands: [{ upToGrams: 5000, priceMinor: 895 }, { upToGrams: 20000, priceMinor: 1595 }], when: { minOrderMinor: 5000 } }] },
        { name: 'Highlands and Islands', regions: 'IV, KW, HS, ZE, PA20–80', rates: [{ label: 'Standard, 3–6 days', priceMinor: 895 }] },
      ];
const MEMBERS: Member[] = [
        { id: 'm1', self: true, name: 'Maya Okafor', email: 'maya@example.com', role: 'owner' as const, status: 'active' as const },
        { id: 'm2', name: 'Tom Hendry', email: 'tom@example.com', role: 'fulfilment' as const, status: 'active' as const },
        { id: 'm3', name: 'Priya Nair', email: 'priya@example.com', role: 'analyst' as const, status: 'active' as const },
      ];
const GRANTS: AccessGrant[] = [
        { id: 'g1', who: 'OSS Support', purpose: 'Ticket 2041: checkout page error', scopes: ['Read orders'], write: false, state: 'pending' as const, expires: '2026-11-14T12:00:00Z' },
        { id: 'g2', who: 'OSS Engineering', purpose: 'Domain verification', scopes: ['Read settings'], write: false, state: 'active' as const, expires: '2026-11-15T09:00:00Z' },
      ];
const REQUESTS: ServiceRequest[] = [
      { id: 'sr1', kind: 'product_upload' as const, title: 'Upload 40 new products from my spreadsheet', status: 'quoted' as const, quoteMinor: 18000, createdAt: '2026-11-11T10:00:00Z', detail: 'CSV attached. Please add images from the shared folder.' },
      { id: 'sr2', kind: 'design_change' as const, title: 'Add a gift-wrapping option to the product page', status: 'in_progress' as const, quoteMinor: 24000, createdAt: '2026-11-03T14:30:00Z', detail: 'Optional extra at checkout.' },
      { id: 'sr3', kind: 'content' as const, title: 'Write descriptions for the winter range', status: 'done' as const, quoteMinor: 9500, createdAt: '2026-10-20T09:00:00Z', detail: '12 products.' },
    ];

const AUTOMATIONS_BASE: Automation[] = [
        { id: 'a1', name: 'Order confirmation email', trigger: 'Order paid', action: 'Email the customer', kind: 'transactional' as const, enabled: true, runsMonth: 86, lastRun: '2026-11-14T08:12:00Z' },
        { id: 'a2', name: 'Dispatch email with tracking', trigger: 'Order fulfilled', action: 'Email the customer', kind: 'transactional' as const, enabled: true, runsMonth: 79, lastRun: '2026-11-14T07:40:00Z' },
        { id: 'a3', name: 'Low stock alert', trigger: 'Stock at alert level', action: 'Email you', kind: 'operational' as const, enabled: true, runsMonth: 6, lastRun: '2026-11-13T15:00:00Z' },
        { id: 'a4', name: 'Fulfilment reminder', trigger: 'Order unfulfilled for 48 hours', action: 'Email you', kind: 'operational' as const, enabled: false, runsMonth: 0 },
        { id: 'a5', name: 'Abandoned checkout reminder', trigger: 'Checkout left for 2 hours', action: 'Email the customer', kind: 'marketing' as const, enabled: false, runsMonth: 0, needsConsent: true },
      ];

/** Demo-only view switch (cookie set by /demo). Lets reviewers see how the portal adapts: new store, setting up, live. */
export type DemoState = 'new' | 'setup' | 'live';
async function state(): Promise<DemoState> {
  try { const v = (await cookies()).get('oss_demo')?.value; return v === 'new' || v === 'live' ? v : 'setup'; } catch { return 'setup'; }
}
/** Per-browser scratch copy of the demo data (keyed by the oss_sid cookie). Actions really change it, so every page reflects what you did. */
const log = (x: { activity: ActivityEntry[] }, actor: string, action: string, summary: string) => { x.activity.unshift({ id: (x.activity[0]?.id ?? 0) + 1, at: new Date().toISOString(), actor, action, summary }); };
interface Scratch { orders: Order[]; products: Product[]; discounts: Discount[]; zones: ShippingZone[]; members: Member[]; grants: AccessGrant[]; automationOn: Record<string, boolean>; read: Set<string>; variants: Record<string, { groups: OptionGroup[]; list: Variant[] }>; vstock: Record<string, { tracked: boolean; backorder: boolean; lowAt: number; log: string }>; custNotes: Record<string, { id: string; text: string; at: string; by?: string }[]>; custProfile: Record<string, { firstName: string; lastName: string; phone: string }>; meta: Record<string, { description: string; handle: string; seoTitle: string; seoDescription: string; images: { id: string; url: string; name?: string }[] }>; collections: { id: string; name: string; contains: string; productIds?: string[] }[]; requests: ServiceRequest[]; domainChecks: number; launchRequested: boolean; stockLog: { at: string; product: string; from: number; to: number; reason: string }[]; touched: number; activity: ActivityEntry[] }
const G = globalThis as unknown as { __oss_demo?: Map<string, Scratch> };
async function S(): Promise<Scratch> {
  const sid = await (async () => { try { return (await cookies()).get('oss_sid')?.value ?? 'shared'; } catch { return 'shared'; } })();
  const m = (G.__oss_demo ??= new Map()); let x = m.get(sid);
  if (!x) { x = { orders: structuredClone(ORDERS), products: structuredClone(P), discounts: structuredClone(DISCOUNTS), zones: structuredClone(ZONES), members: structuredClone(MEMBERS), grants: structuredClone(GRANTS), automationOn: {}, read: new Set<string>(), variants: {}, meta: {}, vstock: {}, custNotes: { c0: [{ id: 'n1', text: 'Prefers weekday delivery. Asked about a custom glaze.', at: '2026-11-02T10:30:00Z', by: 'Mo' }] }, custProfile: {}, collections: [{ id: 'c1', name: 'Kitchen and table', contains: 'mug' }, { id: 'c2', name: 'Linen', contains: 'linen' }], requests: structuredClone(REQUESTS), domainChecks: 0, launchRequested: false, stockLog: [], touched: 0, activity: [{ id: 3, at: '2026-11-24T09:12:00Z', actor: 'Tom Hendry', action: 'order.fulfilled', summary: 'Fulfilled order #1043' }, { id: 2, at: '2026-11-23T16:40:00Z', actor: 'Maya Okafor', action: 'product.updated', summary: 'Changed the price of Linen tea towel' }, { id: 1, at: '2026-11-22T11:05:00Z', actor: 'Maya Okafor', action: 'discount.created', summary: 'Created the discount WELCOME10' }] }; m.set(sid, x); if (m.size > 60) m.delete(m.keys().next().value!); }
  tagLines(x);
  return x;
}
/** Gives every order line an id and the item it is, as the live engine does, so line-level actions work the same in the demo. */
function tagLines(x: Scratch) {
  for (const o of x.orders) o.lines.forEach((l, i) => { l.id ??= `${o.id}-${i}`; if (!l.variantId) { const p = x.products.find(q => q.sku === l.sku); const v = p ? detail(x, p).list[0] : undefined; if (v) l.variantId = v.id; } });
}
/** Every product has at least one variant. The mug is seeded with two option groups so the editor has something real to show. */
function metaOf(x: Scratch, p: Product) { return (x.meta[p.id] ??= { description: `${p.title}. Made in small batches and finished by hand.`, handle: p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), seoTitle: '', seoDescription: '', images: [] }); }
/** Works out an edit to an order and, when asked, saves it. Same rules as the live engine: only open, paid orders; nothing below what was already sent; more money needs a payment method. */
function editOrder(x: Scratch, i: import('./gateway').OrderEditApply | import('./gateway').OrderEditInput, save: boolean): import('./gateway').OrderEditPreview {
  const none = { ok: false, message: '', newTotalMinor: 0, changeMinor: 0, shippingMinor: 0, lines: [] as import('./gateway').OrderEditPreview['lines'] };
  const o = x.orders.find(q => q.id === i.orderId); if (!o) return { ...none, message: 'Order not found.' };
  if (o.state !== 'open' || !(o.payment === 'paid' || o.payment === 'partially_refunded')) return { ...none, message: o.state === 'completed' ? 'This order is complete, so it cannot be edited. Use Refund for money back.' : 'Only open, paid orders can be edited.' };
  const next: { line: Order['lines'][number]; qty: number }[] = []; for (const l of o.lines) { const c = i.lines.find(q => q.lineId === l.id); const qty = c ? c.qty : l.qty; if (!Number.isInteger(qty) || qty < 0 || qty > 999) return { ...none, message: 'Quantities must be whole numbers from 0 to 999.' }; if (qty < (l.sent ?? 0)) return { ...none, message: `${l.title} has ${l.sent} already sent, so it cannot go below that.` }; next.push({ line: l, qty }); }
  const adds: { variantId: string; qty: number; title: string; variant?: string; sku: string; unit: number; p: Product }[] = [];
  for (const a of i.add.filter(q => q.qty > 0)) { const f = findVariant(x, a.variantId); if (!f) return { ...none, message: 'One of the items is not available to sell.' }; if (a.qty > Math.max(f.v.onHand - f.v.allocated, 0)) return { ...none, message: `Only ${Math.max(f.v.onHand - f.v.allocated, 0)} of ${f.p.title} left.` }; adds.push({ variantId: a.variantId, qty: a.qty, title: f.p.title, variant: f.v.options.join(' · ') || undefined, sku: f.v.sku, unit: f.v.priceMinor, p: f.p }); }
  const sur = i.surcharge && i.surcharge.amountMinor !== 0 ? i.surcharge.amountMinor : 0; const changed = adds.length > 0 || sur !== 0 || !!i.address || next.some(n => n.qty !== n.line.qty); if (!changed) return { ...none, message: 'Nothing has changed yet.' };
  const lines = [...next.filter(n => n.qty > 0).map(n => ({ title: n.line.title, variant: n.line.variant, qty: n.qty, unitMinor: n.line.unitMinor, lineMinor: n.qty * n.line.unitMinor })), ...adds.map(a => ({ title: a.title, variant: a.variant, qty: a.qty, unitMinor: a.unit, lineMinor: a.qty * a.unit }))];
  if (!lines.length) return { ...none, message: 'An order needs at least one item. To cancel the whole order, use Cancel order.' };
  const newTotal = Math.max(lines.reduce((n, l) => n + l.lineMinor, 0) + o.shippingMinor - o.discountMinor + sur, 0); const change = newTotal - o.totalMinor;
  const pay = (i as import('./gateway').OrderEditApply).payment;
  if (save) {
    if (change > 0 && !pay) return { ...none, message: `The new total is £${(change / 100).toFixed(2)} more. Choose how the extra amount was paid.` };
    for (const n of next) { const d = n.qty - n.line.qty; if (d) { const p = x.products.find(q => q.sku === n.line.sku); if (p) p.allocated = Math.max(p.allocated + d, 0); } n.line.qty = n.qty; }
    o.lines = o.lines.filter(l => l.qty > 0); for (const a of adds) { o.lines.push({ id: `${o.id}-e${o.lines.length}-${Date.now() % 1e6}`, variantId: a.variantId, sku: a.sku, title: a.title, variant: a.variant, qty: a.qty, unitMinor: a.unit }); a.p.allocated += a.qty; }
    o.totalMinor = newTotal; o.taxMinor = Math.round(newTotal / 6); if (change < 0) o.refundedMinor += -change;
    o.shipTo = i.address ? `${i.address.fullName}, ${i.address.line1}, ${i.address.city}, ${i.address.postcode}` : o.shipTo; if (i.address) o.ship = { city: i.address.city, country: 'GB' };
    const at = new Date().toISOString(); o.timeline.push({ at, text: `Order edited: new total £${(newTotal / 100).toFixed(2)}${change > 0 ? `, extra £${(change / 100).toFixed(2)} paid (${pay})` : change < 0 ? `, £${(-change / 100).toFixed(2)} refunded` : ''}.` }); if (i.note?.trim()) o.timeline.push({ at, text: i.note.trim(), note: true, by: 'Mo' });
  }
  return { ok: true, message: '', newTotalMinor: newTotal, changeMinor: change, shippingMinor: o.shippingMinor, lines };
}
/** Every movement for an item in the demo, newest first: reservations, sales and releases from orders (each with its order), and changes by hand. */
function demoMoves(x: Scratch, id: string, sku: string): import('./gateway').StockMove[] {
  const set = x.vstock[id]; const moves: import('./gateway').StockMove[] = [];
  for (const o of x.orders) { if (o.payment === 'failed') continue; for (const l of o.lines) if (l.variantId ? l.variantId === id : l.sku === sku) { const link = { orderId: o.id, orderCode: String(o.number) };
    moves.push({ id: `${o.id}-r`, at: o.placedAt, kind: 'reserved', quantity: l.qty, ...link });
    if (o.state === 'cancelled') moves.push({ id: `${o.id}-x`, at: o.placedAt, kind: 'released', quantity: l.qty, ...link }); else if ((l.sent ?? (o.fulfilment === 'fulfilled' ? l.qty : 0)) > 0) moves.push({ id: `${o.id}-s`, at: o.placedAt, kind: 'sale', quantity: l.sent ?? l.qty, ...link }); } }
  parseLog(set?.log).forEach((e, i) => moves.push({ id: `a${i}`, at: e.at, kind: 'adjusted', quantity: e.to - e.from, reason: e.reason, by: e.by, note: e.note }));
  return moves.sort((a, b) => b.at.localeCompare(a.at));
}
function findVariant(x: Scratch, variantId: string) { for (const p of x.products) { const v = detail(x, p).list.find(q => q.id === variantId); if (v) return { p, v }; } return null; }
/** Keeps a product's totals equal to the sum of its items after an item changes. */
function syncProduct(x: Scratch, p: Product) { const l = detail(x, p).list; p.onHand = l.reduce((n, v) => n + v.onHand, 0); p.allocated = l.reduce((n, v) => n + v.allocated, 0); }
function stockRowsOf(x: Scratch): import('./gateway').StockRow[] {
  return x.products.filter(p => p.status !== 'archived').flatMap(p => detail(x, p).list.map(v => { const st = x.vstock[v.id]; const base = { onHand: v.onHand, allocated: v.allocated, lowAt: st?.lowAt ?? p.threshold ?? DEFAULT_LOW_AT, tracked: st?.tracked ?? true, backorder: st?.backorder ?? false };
    return { variantId: v.id, productId: p.id, title: p.title, variant: v.options.join(' · ') || undefined, sku: v.sku, imageUrl: x.meta[p.id]?.images[0]?.url ?? p.imageUrl, ...base, available: Math.max(v.onHand - v.allocated, 0), status: stockStatus(base), published: p.status === 'published' && v.enabled }; }));
}
function detail(x: Scratch, p: Product): { groups: OptionGroup[]; list: Variant[] } {
  if (!x.variants[p.id]) {
    if (p.id === 'p1') { const groups = [{ name: 'Size', options: ['Small', 'Large'] }, { name: 'Glaze', options: ['Speckled', 'Ocean'] }]; const stock = [12, 10, 11, 9], alloc = [1, 1, 1, 0];
      x.variants.p1 = { groups, list: [['Small', 'Speckled'], ['Small', 'Ocean'], ['Large', 'Speckled'], ['Large', 'Ocean']].map((o, i) => ({ id: `p1v${i}`, options: o, sku: `MUG-${o[0][0]}${o[1][0]}`.toUpperCase(), priceMinor: p.priceMinor + (o[0] === 'Large' ? 400 : 0), onHand: stock[i], allocated: alloc[i], taxClass: 'standard' as const, enabled: true, weightGrams: o[0] === 'Large' ? 420 : 320 })) }; }
    else x.variants[p.id] = { groups: [], list: [{ id: `${p.id}v0`, options: [], sku: p.sku, priceMinor: p.priceMinor, onHand: p.onHand, allocated: p.allocated, taxClass: 'standard', enabled: true }] };
  }
  return x.variants[p.id];
}
const ordersFor = async (st: DemoState) => (st === 'new' ? [] : (await S()).orders);
const productsFor = async (st: DemoState) => (st === 'new' ? [] : (await S()).products);
const NOTE = ' Demo data: nothing was changed.';
const okDemo = (m: string) => ({ ok: true, message: m + NOTE });
export const demoGateway: CommerceGateway = {
  async viewer() { return { name: 'Maya Okafor', initials: 'MO', role: 'Owner', kind: 'owner' as const }; },
  async store() {
    const st = await state();
    const done: Record<string, boolean> = st === 'live' ? { contract_signed: true, payments_enabled: true, domain_verified: true, test_order_passed: true, launch_approved: true }
      : st === 'new' ? { contract_signed: true, payments_enabled: false, domain_verified: false, test_order_passed: false, launch_approved: false }
      : { contract_signed: true, payments_enabled: true, domain_verified: false, test_order_passed: false, launch_approved: false };
    return {
      name: 'Kiln & Thread',
      store: { storeId: StoreId.parse('st_demo'), organisationId: OrganisationId.parse('org_demo'), cellId: 'cell-demo', hostnames: [{ host: 'kilnandthread.example', verified: st === 'live' }], region: 'eu-west-london', lifecycle: st === 'live' ? 'live' : 'configuring', entitlementVersion: 1, paymentReadiness: st === 'new' ? 'not_started' : 'enabled' },
      readiness: LAUNCH_GATES.map(g => ({ gate: g, done: done[g], ...GATE_COPY[g] })),
    };
  },
  async billing(): Promise<Billing> {
    const st = await state(); const base = { demo: true, planName: LAUNCH_PLAN.name, monthlyMinor: LAUNCH_PLAN.monthlyMinor, buildMinor: LAUNCH_PLAN.buildFromMinor };
    const build = { number: 'OSC-0001', description: 'Storefront design and build', issuedAt: '2026-08-04T09:00:00Z', amountMinor: LAUNCH_PLAN.buildFromMinor, status: 'paid' as const };
    if (st !== 'live') return { ...base, status: 'not_started', invoices: st === 'new' ? [] : [build] };
    return { ...base, status: 'active', nextInvoiceAt: '2026-12-01T09:00:00Z', invoices: [{ number: 'OSC-0004', description: 'OneSimpleCommerce, November', issuedAt: '2026-11-01T09:00:00Z', amountMinor: LAUNCH_PLAN.monthlyMinor, status: 'paid' }, { number: 'OSC-0003', description: 'OneSimpleCommerce, October', issuedAt: '2026-10-01T09:00:00Z', amountMinor: LAUNCH_PLAN.monthlyMinor, status: 'paid' }, { number: 'OSC-0002', description: 'OneSimpleCommerce, September', issuedAt: '2026-09-01T09:00:00Z', amountMinor: LAUNCH_PLAN.monthlyMinor, status: 'paid' }, build] };
  },
  async startBillingPortal(): Promise<StartPaymentSetup> { return { ok: false, message: 'Billing management opens in Stripe once the store is connected to the live platform. This is a demo.' }; },
  async live(): Promise<LiveView> {
    const st = await state(); if (st === 'new') return { demo: true, tracked: true, points: [], recent: [], asOf: AS_OF, visitorsNow: 0, sessions: { value: 0, vsPrev: 0 }, salesMinor: { value: 0, vsPrev: 0 }, orders: { value: 0, vsPrev: 0 }, behaviour: { activeCarts: 0, checkingOut: 0, purchased: 0 }, locations: [], returning: { newCustomers: 0, returning: 0 } };
    const all = await ordersFor(st); const since = new Date(Date.parse(AS_OF) - 30 * 86400_000).toISOString(); const points = orderPoints(all, since).map((p, k) => ({ ...p, sessions: p.orders * 6 + (k % 4) }));
    return { demo: true, tracked: true, asOf: AS_OF, visitorsNow: 3, sessions: { value: 76, vsPrev: 62 }, salesMinor: { value: 14000, vsPrev: 1300 }, orders: { value: 8, vsPrev: 300 }, behaviour: { activeCarts: 2, checkingOut: 1, purchased: 1 }, locations: points.slice(0, 6).map(p => ({ place: p.place, sessions: p.sessions ?? 0 })), points, recent: recentOrders(all, 8), returning: { newCustomers: 5, returning: 3 } };
  },
  async summary(): Promise<Summary> {
    const st = await state(); const ALL = await ordersFor(st);
    const paid = ALL.filter(o => o.payment !== 'failed');
    const gross = paid.reduce((s, o) => s + o.totalMinor, 0);
    const refunded = paid.reduce((s, o) => s + o.refundedMinor, 0);
    const day = (n: number) => new Date(Date.parse(AS_OF) - n * 86400_000).toISOString().slice(0, 10);
    const series = Array.from({ length: 14 }, (_, k) => {
      const d = day(13 - k); const os = paid.filter(o => o.placedAt.slice(0, 10) === d);
      const g = os.reduce((s, o) => s + o.totalMinor, 0);
      return { day: d, grossMinor: g, netMinor: g - os.reduce((s, o) => s + o.refundedMinor, 0) };
    });
    const byProduct = new Map<string, number>();
    for (const o of paid) for (const l of o.lines) byProduct.set(l.title, (byProduct.get(l.title) ?? 0) + l.qty * l.unitMinor);
    const topProducts = [...byProduct].map(([title, netMinor]) => ({ title, netMinor })).sort((a, b) => b.netMinor - a.netMinor);
    const count = (f: (o: Order) => boolean) => ALL.filter(f).length;
    return {
      netMinor: gross - refunded, grossMinor: gross, orders: paid.length, aovMinor: paid.length ? Math.round(gross / paid.length) : 0, refundedMinor: refunded,
      toFulfil: count(o => o.state === 'open'), fulfilled: count(o => o.state === 'completed'), paidOrders: paid.length,
      lowStock: (await productsFor(st)).filter(p => p.status === 'published' && p.onHand - p.allocated <= p.threshold).length, series, topProducts,
      statusMix: [{ label: 'Fulfilled', count: count(o => o.state === 'completed') }, { label: 'To fulfil', count: count(o => o.state === 'open') }, { label: 'Cancelled', count: count(o => o.state === 'cancelled') }],
      asOf: AS_OF,
    };
  },
  async reportOrders(fromYmd) { const all = [...await ordersFor(await state()), ...(await state() === 'new' ? [] : HISTORY)]; return all.filter(o => o.placedAt.slice(0, 10) >= fromYmd); },
  async orders(q) {
    let r = await ordersFor(await state());
    if (q?.filter === 'unfulfilled') r = r.filter(o => o.state === 'open');
    if (q?.filter === 'attention') r = r.filter(o => o.payment === 'failed' || o.payment === 'disputed');
    if (q?.filter === 'refunded') r = r.filter(o => o.refundedMinor > 0);
    if (q?.q) { const s = q.q.toLowerCase(); r = r.filter(o => `${o.number} ${o.customer} ${o.email}`.toLowerCase().includes(s)); }
    return r;
  },
  async order(id) { return (await ordersFor(await state())).find(o => o.id === id) ?? null; },
  async products() { const x = await S(); const ps = await productsFor(await state()); return ps.map(p => ({ ...p, imageUrl: x.meta[p.id]?.images[0]?.url ?? p.imageUrl })); },
  async customers() {
    if ((await state()) === 'new') return []; const x = await S();
    return CUSTOMERS.map(c => { const p = x.custProfile[c.id]; const os = x.orders.filter(o => o.email.toLowerCase() === c.email.toLowerCase() && o.payment !== 'failed'); // the same orders the detail page lists
      const stats = os.length ? { orders: os.length, spentMinor: os.reduce((n, o) => n + o.totalMinor - o.refundedMinor, 0), lastOrder: os.map(o => o.placedAt).sort().at(-1)! } : {};
      return { ...c, ...stats, ...(p ? { name: `${p.firstName} ${p.lastName}`.trim() || c.name } : {}) }; });
  },
  async orderableItems() { const x = await S(); return x.products.filter(p => p.status === 'published').flatMap(p => detail(x, p).list.filter(v => v.enabled).map(v => ({ variantId: v.id, productId: p.id, title: p.title, variant: v.options.join(' · ') || undefined, sku: v.sku, priceMinor: v.priceMinor, available: Math.max(v.onHand - v.allocated, 0) }))); },
  async shippingChoices() { return [{ id: 'std', name: 'Standard delivery, 2–4 days' }, { id: 'next', name: 'Next day' }, { id: 'collect', name: 'Collection (free)' }]; },
  async createManualOrder(i) {
    const x = await S(); const items = i.items.filter(l => l.qty > 0); if (!items.length) return { ok: false, message: 'Add at least one item.' };
    if (!i.shippingMethodId) return { ok: false, message: 'Choose a delivery option. For a sale in person, choose Collection.' };
    if ('email' in i.customer && !/^\S+@\S+\.\S+$/.test(i.customer.email)) return { ok: false, message: 'Enter a valid email address for the customer.' };
    const all = await demoGateway.orderableItems(); const lines: import('./gateway').OrderLine[] = [];
    for (const l of items) { const v = all.find(a => a.variantId === l.variantId); if (!v) return { ok: false, message: 'One of the items is not available to sell.' }; if (l.qty > v.available) return { ok: false, message: `Only ${v.available} of ${v.title}${v.variant ? ` (${v.variant})` : ''} in stock.` }; lines.push({ sku: v.sku, title: v.title, variant: v.variant, qty: l.qty, unitMinor: v.priceMinor, sent: 0 }); }
    let discount = 0; if (i.coupon?.trim()) { const d = x.discounts.find(q => q.code === i.coupon!.trim().toUpperCase() && q.status === 'active'); if (!d) return { ok: false, message: 'That discount code does not work.' }; const sub0 = lines.reduce((n, l) => n + l.qty * l.unitMinor, 0); discount = d.kind === 'percent' ? Math.round(sub0 * d.value / 100) : d.kind === 'fixed' ? Math.min(d.value, sub0) : 0; }
    const sub = lines.reduce((n, l) => n + l.qty * l.unitMinor, 0); const ship = i.shippingMethodId === 'collect' ? 0 : i.shippingMethodId === 'next' ? 795 : (sub >= 5000 ? 0 : 495); const total = sub - discount + ship;
    const cust = 'id' in i.customer ? (await demoGateway.customers()).find(c => c.id === (i.customer as { id: string }).id) : null; if ('id' in i.customer && !cust) return { ok: false, message: 'That customer no longer exists.' };
    const name = cust ? cust.name : `${(i.customer as { firstName: string }).firstName} ${(i.customer as { lastName: string }).lastName}`.trim(); const email = cust ? cust.email : (i.customer as { email: string }).email; const number = Math.max(...x.orders.map(o => o.number)) + 1; const at = new Date(AS_OF).toISOString();
    const label = { cash: 'cash', card_in_person: 'card, in person', bank_transfer: 'bank transfer', other: 'another way' }[i.payment];
    x.orders.unshift({ id: `o${number}`, number, placedAt: at, customer: name, email, lines, shippingMinor: ship, discountMinor: discount, taxMinor: Math.round(total / 6), totalMinor: total, payment: 'paid', fulfilment: 'unfulfilled', state: 'open', refundedMinor: 0, shipTo: i.address ? `${i.address.fullName}, ${i.address.line1}, ${i.address.city}, ${i.address.postcode}` : '', ship: i.address ? { city: i.address.city, country: 'GB' } : undefined,
      timeline: [{ at, text: 'Order placed by hand.' }, { at, text: `Payment received (${label}).` }, ...(i.note?.trim() ? [{ at, text: i.note.trim(), note: true, by: 'Mo' }] : [])] });
    for (const l of lines) for (const p of x.products) { const d = detail(x, p); const v = d.list.find(q => q.sku === l.sku); if (v) { v.allocated += l.qty; if (p.sku === l.sku) p.allocated += l.qty; } }
    return { ok: true, id: `o${number}`, message: `Order placed and marked as paid (${label}). Stock is reserved.` };
  },
  async stockRows() { const x = await S(); return stockRowsOf(x); },
  async stockDetail(id) { const x = await S(); const row = stockRowsOf(x).find(r => r.variantId === id); if (!row) return null; const all = demoMoves(x, id, row.sku); return { ...row, moves: all.slice(0, 50), totalMoves: all.length }; },
  async stockMoves(id, page) { const x = await S(); const row = stockRowsOf(x).find(r => r.variantId === id); if (!row) return []; return demoMoves(x, id, row.sku).slice(50 * page, 50 * page + 50); },
  async adjustVariantStock(a) {
    const x = await S(); const hit = findVariant(x, a.variantId); if (!hit) return { ok: false, message: 'That item no longer exists.' }; const { p, v } = hit;
    const plan = planAdjust({ onHand: v.onHand, allocated: v.allocated }, a); if (!plan.ok) return { ok: false, message: plan.error }; if (plan.delta === 0) return { ok: true, message: `No change: ${p.title} already has ${v.onHand}.` };
    const from = v.onHand; v.onHand = plan.to; syncProduct(x, p); const st = (x.vstock[v.id] ??= { tracked: true, backorder: false, lowAt: p.threshold ?? DEFAULT_LOW_AT, log: '[]' }); st.log = appendLog(st.log, { at: new Date(AS_OF).toISOString(), from, to: plan.to, reason: a.reason, by: a.by, note: a.note });
    x.stockLog.unshift({ at: new Date().toISOString(), product: p.title, from, to: plan.to, reason: a.reason }); return { ok: true, message: `${p.title} (${v.sku}): ${from} to ${plan.to} on hand.` };
  },
  async saveStockSettings(id, s) {
    const x = await S(); const hit = findVariant(x, id); if (!hit) return { ok: false, message: 'That item no longer exists.' }; if (!Number.isInteger(s.lowAt) || s.lowAt < 0 || s.lowAt > 100_000) return { ok: false, message: 'The low stock level must be a whole number from 0 to 100,000.' };
    const st = (x.vstock[id] ??= { tracked: true, backorder: false, lowAt: hit.p.threshold ?? DEFAULT_LOW_AT, log: '[]' }); Object.assign(st, { tracked: s.tracked, backorder: s.backorder, lowAt: s.lowAt });
    return { ok: true, message: !s.tracked ? 'Stock is no longer counted for this item. It can always be bought.' : s.backorder ? 'Saved. Customers can keep buying this when it runs out.' : 'Saved.' };
  },
  async applyStockCount(lines, by, note) {
    const x = await S(); const none = { changed: 0, unchanged: 0, problems: [] as { variantId: string; error: string }[] }; if (!lines.length) return { ok: false, message: 'Count at least one item.', ...none };
    const rows = x.products.flatMap(p => detail(x, p).list.map(v => ({ variantId: v.id, onHand: v.onHand, allocated: v.allocated }))); const plan = planCount(rows, lines);
    for (const c of plan.changes) { const hit = findVariant(x, c.variantId)!; hit.v.onHand = c.to; syncProduct(x, hit.p); const st = (x.vstock[c.variantId] ??= { tracked: true, backorder: false, lowAt: hit.p.threshold ?? DEFAULT_LOW_AT, log: '[]' }); st.log = appendLog(st.log, { at: new Date(AS_OF).toISOString(), from: c.from, to: c.to, reason: 'recount', by, note: note ?? 'Stock count' }); }
    const msg = plan.changes.length ? `Stock count saved: ${plan.changes.length} item${plan.changes.length > 1 ? 's' : ''} changed, ${plan.unchanged} already right.` : `Nothing to change: ${plan.unchanged} item${plan.unchanged === 1 ? '' : 's'} already matched.`;
    return { ok: plan.changes.length > 0 || plan.problems.length === 0, message: plan.problems.length ? `${msg} ${plan.problems.length} could not be applied.` : msg, changed: plan.changes.length, unchanged: plan.unchanged, problems: plan.problems };
  },
  async customer(id) {
    if ((await state()) === 'new') return null; const x = await S(); const base = (await demoGateway.customers()).find(c => c.id === id); if (!base) return null;
    const prof = x.custProfile[id]; const [f, ...r] = base.name.split(' '); const os = x.orders.filter(o => o.email.toLowerCase() === base.email.toLowerCase()); const sales = os.filter(o => o.payment !== 'failed');
    return { ...base, firstName: prof?.firstName ?? f, lastName: prof?.lastName ?? r.join(' '), phone: prof?.phone ?? '', since: '2026-03-12T10:00:00Z', aovMinor: sales.length ? Math.round(sales.reduce((s, o) => s + o.totalMinor, 0) / sales.length) : 0,
      addresses: os.slice(0, 1).map(o => `${o.customer}, ${o.shipTo}`), recentOrders: os.map(o => ({ id: o.id, number: o.number, placedAt: o.placedAt, totalMinor: o.totalMinor, payment: o.payment, fulfilment: o.fulfilment, items: o.lines.map(l => `${l.qty} × ${l.title}`).join(', ') })), notes: [...(x.custNotes[id] ?? [])].reverse() };
  },
  async addCustomerNote(id, text) { const x = await S(); const n = text.trim(); if (!n) return { ok: false, message: 'Write a note first.' }; if (n.length > 2000) return { ok: false, message: 'Notes are limited to 2,000 characters.' }; if (!CUSTOMERS.some(c => c.id === id)) return { ok: false, message: 'Customer not found.' }; (x.custNotes[id] ??= []).push({ id: `n${Date.now().toString(36)}`, text: n, at: new Date().toISOString(), by: 'Mo' }); return { ok: true, message: 'Note added. Only your team can see it.' }; },
  async deleteCustomerNote(id, noteId) { const x = await S(); const l = x.custNotes[id] ?? []; const i = l.findIndex(n => n.id === noteId); if (i < 0) return { ok: false, message: 'That note no longer exists.' }; l.splice(i, 1); return { ok: true, message: 'Note deleted.' }; },
  async updateCustomerProfile(id, p) { const x = await S(); if (!CUSTOMERS.some(c => c.id === id)) return { ok: false, message: 'Customer not found.' }; if (!p.firstName.trim() && !p.lastName.trim()) return { ok: false, message: 'Enter a name.' }; if (p.phone && !/^[+()\d\s-]{6,24}$/.test(p.phone)) return { ok: false, message: 'Enter a phone number with digits, spaces, + or dashes.' }; x.custProfile[id] = { firstName: p.firstName.trim(), lastName: p.lastName.trim(), phone: p.phone.trim() }; return { ok: true, message: 'Customer details saved.' }; },
  async discounts() { return (await S()).discounts; },
  async storefront() {
    const x = await S();
    return {
      launchRequested: x.launchRequested,
      theme: { name: 'Kiln', version: '1.4.2', deployedAt: '2026-11-12T16:20:00Z', state: 'healthy' as const },
      previewUrl: 'https://preview.kilnandthread.example', liveUrl: null,
      checks: [
        { label: 'Checkout reachable', ok: true, detail: 'Tested 2 min ago' },
        { label: 'Product feed in sync', ok: true, detail: '7 products · last sync 2 min ago' },
        { label: 'Domain and SSL', ok: false, detail: 'DNS record not found yet' },
        { label: 'Legal pages', ok: true, detail: 'Terms, privacy and returns present' },
      ],
      history: [
        { version: '1.4.2', at: '2026-11-12T16:20:00Z', note: 'Updated product page spacing', current: true },
        { version: '1.4.1', at: '2026-11-09T11:05:00Z', note: 'Added size guide section', current: false },
        { version: '1.4.0', at: '2026-11-02T09:40:00Z', note: 'New collection layout', current: false },
      ],
    };
  },
  async team() { const x = await S(); return { members: x.members, grants: x.grants }; },
  /** Demo only: every state the real platform can report, selectable with ?state= so each can be reviewed. */
  async paymentSetup(preview?: string): Promise<PaymentSetup> {
    const base = { applicationFeeBp: 50, account: 'acct_••••3F2A', payoutSchedule: 'Weekly, Fridays', chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [] as string[], pending: [] as string[] };
    const states: Record<string, PaymentSetup> = {
      not_started: { ...base, account: undefined, status: 'not_started', headline: 'Set up payments', detail: 'Connect your bank account so customers can pay and you get paid directly.' },
      onboarding: { ...base, status: 'onboarding', headline: 'Finish setting up payments', detail: 'A few details are still needed before customers can pay.', actionRequired: true, due: ['Business address', 'Bank account for payouts', 'Accept Stripe terms'] },
      pending_verification: { ...base, status: 'pending_verification', headline: 'Stripe is verifying your details', detail: 'Checkout turns on as soon as verification completes.', pending: ['Identity check'] },
      action_required: { ...base, status: 'action_required', headline: 'Action needed soon', detail: 'Provide the missing details before the deadline to avoid interruption.', chargesEnabled: true, payoutsEnabled: true, checkoutAllowed: true, actionRequired: true, due: ['Business tax ID'], deadline: '2026-12-01T00:00:00.000Z' },
      restricted: { ...base, status: 'restricted', headline: 'Payments are not available', detail: 'Stripe has limited this account. Contact support so we can help with next steps.', actionRequired: true },
      payouts_paused: { ...base, status: 'payouts_paused', headline: 'Payouts are paused', detail: 'Customers can pay, but payouts to your bank are on hold. Check your bank details.', chargesEnabled: true, checkoutAllowed: true, actionRequired: true, due: ['Confirm bank account'] },
      disconnected: { ...base, status: 'disconnected', headline: 'Stripe is disconnected', detail: 'Checkout is paused. Past orders and refunds stay available. Reconnect to take payments again.', actionRequired: true },
      enabled: { ...base, status: 'enabled', headline: 'Payments are on', detail: 'Customers can pay and payouts go to your bank.', chargesEnabled: true, payoutsEnabled: true, checkoutAllowed: true },
    };
    let pick = preview; if (!pick) { try { pick = (await cookies()).get('oss_pay')?.value; } catch { /* outside a request */ } }
    return states[pick ?? 'enabled'] ?? states.enabled;
  },
  async startPaymentSetup(): Promise<StartPaymentSetup> { return { ok: false, message: 'Stripe onboarding opens here once the store is connected to the live platform. This is a demo.' }; },
  async shippingTax() {
    return {
      zones: (await S()).zones, unweighed: 3,
      pricesIncludeTax: true, vatRegistered: null,
      payments: { account: 'acct_••••3F2A', capabilities: [{ label: 'Card payments', ok: true }, { label: 'Payouts', ok: true }, { label: 'Identity verification', ok: true }], applicationFeeBp: 50, payouts: 'Weekly, Fridays' },
    };
  },
  async content(): Promise<import('./gateway').ContentView> {
    return {
      page: { id: 'home', title: 'Homepage', path: '/' }, publishedAt: '2026-11-12T16:20:00Z', previewUrl: 'https://preview.kilnandthread.example/?preview=1',
      sections: [
        { id: 's1', type: 'announcement' as const, label: 'Announcement bar', changed: false, fields: { text: 'Free UK delivery on orders over £50', link: '/shipping' } },
        { id: 's2', type: 'hero' as const, label: 'Hero', changed: true, fields: { headline: 'Made by hand, slowly.', subheading: 'Small-batch ceramics, glazed in the studio.', buttonLabel: 'Shop the collection', buttonLink: '/collections/all' } },
        { id: 's3', type: 'image_text' as const, label: 'Our studio', changed: false, fields: { heading: 'From the studio', body: 'Every piece is thrown, glazed and fired in our Bristol studio.', imageAlt: '' } },
        { id: 's4', type: 'product_row' as const, label: 'Featured products', changed: true, fields: { heading: 'Newly arrived', collection: 'new-in' } },
        { id: 's5', type: 'faq' as const, label: 'Delivery questions', changed: false, fields: { heading: 'Delivery and returns', body: 'We dispatch within 2 working days. Returns are accepted within 30 days.' } },
      ],
      versions: [{ id: 'v12', at: '2026-11-12T16:20:00Z', note: 'Published: new hero', current: true }, { id: 'v11', at: '2026-11-05T10:02:00Z', note: 'Published: announcement bar', current: false }, { id: 'v10', at: '2026-10-28T09:40:00Z', note: 'Published: seasonal collection', current: false }],
    };
  },
  async legalPages() {
    const t = (n: string) => `This ${n} is provided by Kiln & Thread ({{business address}}). Contact us at {{support email}}.\n\nWrite your policy here, then check it suits your business.`;
    return [
      { slug: 'privacy' as const, title: 'Privacy policy', status: 'published' as const, updatedAt: '2026-10-02T10:00:00Z', body: t('privacy policy') },
      { slug: 'terms' as const, title: 'Terms and conditions', status: 'draft' as const, updatedAt: '2026-11-10T09:00:00Z', body: t('terms and conditions') },
      { slug: 'shipping' as const, title: 'Shipping policy', status: 'not_set_up' as const, body: t('shipping policy') },
      { slug: 'returns' as const, title: 'Returns and refunds policy', status: 'not_set_up' as const, body: t('returns policy') },
    ];
  },
  async automations() {
    const on = (await S()).automationOn;
    return {
      runsLimit: 1000,
      rules: AUTOMATIONS_BASE.map(r => ({ ...r, enabled: on[r.id] ?? r.enabled })),
      runs: [
        { id: 'r1', at: '2026-11-14T08:12:00Z', automation: 'Order confirmation email', event: 'Order #1042 paid', outcome: 'sent' as const, detail: 'Delivered to maya@example.com' },
        { id: 'r2', at: '2026-11-14T07:40:00Z', automation: 'Dispatch email with tracking', event: 'Order #1038 fulfilled', outcome: 'sent' as const, detail: 'Delivered to elena@example.com' },
        { id: 'r3', at: '2026-11-13T15:00:00Z', automation: 'Low stock alert', event: 'Serving bowl at 3 units', outcome: 'sent' as const, detail: 'Sent to you' },
        { id: 'r4', at: '2026-11-13T11:20:00Z', automation: 'Order confirmation email', event: 'Order #1036 paid', outcome: 'failed_retrying' as const, detail: 'Mailbox busy. Retrying in 10 minutes (attempt 2 of 5)' },
      ],
    };
  },
  async serviceRequests() { return (await S()).requests; },
  async emailSettings() {
    return { brand: { shopName: 'Kiln & Thread', accent: '#262629', supportEmail: 'hello@kilnandthread.example', footer: 'Thank you for supporting a small studio.' }, notifications: { newOrder: true, lowStock: true, paymentIssue: true, dailySummary: false }, sendingDomain: { host: 'mail.kilnandthread.example', verified: false } };
  },
  async preferences() { return { lowStock: true, newOrder: true, guest: true, consent: false, showSoldOut: true, pause: false }; },
  async saveSection() { return okDemo('Section saved as a draft.'); },
  async publishContent() { return okDemo('Published to your storefront.'); },
  async saveLegal(_s, _b, publish) { return okDemo(publish ? 'Page published.' : 'Draft saved.'); },
  async setAutomation(id, on) {
    const x = await S(); const r = AUTOMATIONS_BASE.find(a => a.id === id); if (!r) return { ok: false, message: 'That automation no longer exists.' };
    if (r.kind === 'transactional' && !on) return { ok: false, message: 'Order emails cannot be turned off. Customers need them.' };
    x.automationOn[id] = on; return { ok: true, message: `${r.name} is ${on ? 'on' : 'off'}.` };
  },
  async createServiceRequest(kind, title, detail) {
    const x = await S(); x.requests.unshift({ id: `sr${Date.now().toString(36)}`, kind, title, status: 'submitted', createdAt: new Date().toISOString(), detail }); return { ok: true, message: 'Request sent. We will reply with a quote before any work starts.' };
  },
  async decideQuote(id, approve) {
    const x = await S(); const r = x.requests.find(q => q.id === id); if (!r || r.status !== 'quoted') return { ok: false, message: 'This quote is no longer open.' };
    r.status = approve ? 'in_progress' : 'declined'; return { ok: true, message: approve ? 'Quote approved. The work is billed separately, as quoted.' : 'Quote declined. Nothing will be charged.' };
  },
  async saveEmailSettings() { return okDemo('Email settings saved.'); },
  async fulfilOrder(id, tracking, only) {
    const x = await S(); const o = x.orders.find(q => q.id === id); if (!o) return { ok: false, message: 'Order not found.' };
    if (o.state === 'cancelled' || o.payment === 'failed') return { ok: false, message: 'This order was not paid, so it cannot be fulfilled.' };
    if (o.fulfilment === 'fulfilled') return { ok: false, message: 'This order is already fulfilled.' };
    const want = only ? new Map(only.map(l => [l.sku, l.qty])) : null; let sentNow = 0;
    for (const l of o.lines) { const left = l.qty - (l.sent ?? 0); const q = want ? Math.min(left, Math.max(0, Math.floor(want.get(l.sku) ?? 0))) : left; l.sent = (l.sent ?? 0) + q; sentNow += q; }
    if (!sentNow) return { ok: false, message: want ? 'Choose at least one item to send.' : 'This order is already fulfilled.' };
    const all = o.lines.every(l => (l.sent ?? 0) >= l.qty); o.fulfilment = all ? 'fulfilled' : 'partial'; o.state = all ? 'completed' : 'open';
    o.timeline.push({ at: new Date().toISOString(), text: `${all ? 'Fulfilled' : 'Part of the order sent'}${tracking ? `. Tracking ${tracking}` : ''}. Confirmation emailed to ${o.email}.` });
    return { ok: true, message: `${all ? `Order #${o.number} marked fulfilled.` : `Part of order #${o.number} marked as sent.`} ${o.customer.split(' ')[0]} has been emailed.` };
  },
  async cancelOrder(i) {
    const x = await S(); const o = x.orders.find(q => q.id === i.orderId); if (!o) return { ok: false, message: 'Order not found.' };
    if (o.state === 'cancelled') return { ok: false, message: 'This order is already cancelled.' };
    if (o.fulfilment !== 'unfulfilled' || o.lines.some(l => (l.sent ?? 0) > 0)) return { ok: false, message: 'Part of this order has already been sent, so it cannot be cancelled. Refund what is needed instead.' };
    const hadPaid = o.payment === 'paid'; o.state = 'cancelled';
    o.timeline.push({ at: new Date().toISOString(), text: `Order cancelled${i.reason ? `: ${i.reason}` : ''}.` });
    if (i.refund && hadPaid) { const left = o.totalMinor - o.refundedMinor; o.refundedMinor += left; o.payment = 'refunded'; o.timeline.push({ at: new Date().toISOString(), text: `Refund of £${(left / 100).toFixed(2)} confirmed.` }); return { ok: true, message: `Order cancelled and £${(left / 100).toFixed(2)} refunded to ${o.customer.split(' ')[0]}.` }; }
    return { ok: true, message: hadPaid ? 'Order cancelled and its stock released. The customer has not been refunded yet.' : 'Order cancelled and its stock released.' };
  },
  async addOrderNote(orderId, note) {
    const x = await S(); const o = x.orders.find(q => q.id === orderId); if (!o) return { ok: false, message: 'Order not found.' }; const n = note.trim(); if (!n) return { ok: false, message: 'Write a note first.' }; if (n.length > 2000) return { ok: false, message: 'Notes are limited to 2,000 characters.' };
    o.timeline.push({ at: new Date().toISOString(), text: n, note: true, by: 'Mo' }); return { ok: true, message: 'Note added. Only your team can see it.' };
  },
  async refundOrder(i) {
    const x = await S(); const o = x.orders.find(q => q.id === i.orderId); if (!o) return { ok: false, message: 'Order not found.' };
    const left = o.totalMinor - o.refundedMinor; if (o.payment === 'failed') return { ok: false, message: 'Nothing was charged, so there is nothing to refund.' };
    if (i.amountMinor <= 0) return { ok: false, message: 'Enter an amount to refund.' }; if (i.amountMinor > left) return { ok: false, message: `You can refund up to £${(left / 100).toFixed(2)} on this order.` };
    const lines = (i.lines ?? []).filter(l => l.qty > 0); for (const l of lines) { const k = o.lines.find(q => q.id === l.lineId); if (!k) return { ok: false, message: 'One of the returned items is not on this order.' }; if (l.qty > k.qty) return { ok: false, message: 'You cannot return more of an item than the order holds.' }; }
    o.refundedMinor += i.amountMinor; const full = o.refundedMinor >= o.totalMinor; o.payment = full ? 'refunded' : 'partially_refunded'; if (full) o.state = 'cancelled';
    // Our fee on the refunded part always goes back (platform policy), so it is stated, not offered as a choice.
    const fee = feeRefundMinor({ chargeMinor: o.totalMinor, feeMinor: feeMinor(o.totalMinor, 50), refundMinor: i.amountMinor, refundsReturnFee: true });
    let back = 0; if (i.restock) for (const l of lines) { const k = o.lines.find(q => q.id === l.lineId)!; const p = x.products.find(q => q.sku === k.sku); if (p) { p.onHand += l.qty; back += l.qty; const v = k.variantId ? findVariant(x, k.variantId) : null; if (v) { v.v.onHand += l.qty; syncProduct(x, v.p); } } }
    o.timeline.push({ at: new Date().toISOString(), text: `Refund of £${(i.amountMinor / 100).toFixed(2)} confirmed${i.reason ? ` (${i.reason})` : ''}.${back ? ` ${back} item${back > 1 ? 's' : ''} put back in stock.` : ''}` });
    return { ok: true, message: `Refunded £${(i.amountMinor / 100).toFixed(2)} to ${o.customer.split(' ')[0]}. Our fee on it (£${(fee / 100).toFixed(2)}) is returned to you.${back ? ` ${back} item${back > 1 ? 's' : ''} back in stock.` : ''}` };
  },
  async abandonedCheckouts() {
    const st = await state(); if (st === 'new') return { asOf: AS_OF, items: [], valueMinor: 0, anonymous: 0 };
    const at = (h: number) => new Date(Date.parse(AS_OF) - h * 3600_000).toISOString();
    const items = [
      { id: 'ab1', code: 'KT7Q2M', name: 'Hannah Cole', email: 'hannah@example.com', stage: 'checkout' as const, totalMinor: 7595, lastActiveAt: at(3), lines: [{ title: 'Serving bowl, large', qty: 1, unitMinor: 4200 }, { title: 'Linen apron', qty: 1, unitMinor: 3400 }] },
      { id: 'ab2', code: 'KT4PX1', name: 'Dev Patel', email: 'dev@example.com', stage: 'cart' as const, totalMinor: 3600, lastActiveAt: at(26), lines: [{ title: 'Stoneware mug, speckled', variant: 'Large · Ocean', qty: 2, unitMinor: 1800 }] },
      { id: 'ab3', code: 'KT9ZZ0', email: 'orla@example.com', stage: 'cart' as const, totalMinor: 2200, lastActiveAt: at(70), lines: [{ title: 'Tea towel set', qty: 1, unitMinor: 2200 }] },
    ];
    return { asOf: AS_OF, items, valueMinor: items.reduce((n, i) => n + i.totalMinor, 0), anonymous: 5 };
  },
  async resolveOrderEdit() { return { ok: true, message: 'This order is not part-way through an edit.' }; },
  async previewOrderEdit(i) { return editOrder(await S(), i, false); },
  async applyOrderEdit(i) {
    const x = await S(); const p = await editOrder(x, i, true); if (!p.ok) return { ok: false, message: p.message };
    return { ok: true, message: p.changeMinor > 0 ? `Order updated. The extra £${(p.changeMinor / 100).toFixed(2)} is recorded as paid.` : p.changeMinor < 0 ? `Order updated. £${(-p.changeMinor / 100).toFixed(2)} refunded to the customer's original payment method.` : 'Order updated. The total is unchanged.' };
  },
  async inviteMember(i) {
    const x = await S(); const email = i.email.trim().toLowerCase(); if (x.members.some(m => m.email.toLowerCase() === email)) return { ok: false, message: 'That email already has an account. Use a different email address for this person.' };
    const id = `m${Date.now().toString(36)}`; x.members.push({ id, name: `${i.firstName} ${i.lastName}`.trim(), email, role: i.role, status: 'active' });
    log(x, 'You', 'staff.invited', `Added ${i.firstName} ${i.lastName} as ${ROLE_INFO[i.role].label}`); return { ok: true, message: `${i.firstName} has been added.`, id, secret: 'demo-Passw0rd-1' };
  },
  async setMemberRole(id, role) { const x = await S(); const m = x.members.find(q => q.id === id && q.role !== 'owner'); if (!m) return { ok: false, message: 'That team member was not found.' }; m.role = role; log(x, 'You', 'staff.role', `Changed ${m.name} to ${ROLE_INFO[role].label}`); return { ok: true, message: 'Role changed. It applies the next time they open a page.' }; },
  async removeMember(id) { const x = await S(); const m = x.members.find(q => q.id === id && q.role !== 'owner'); if (!m) return { ok: false, message: 'That team member was not found.' }; x.members = x.members.filter(q => q !== m); log(x, 'You', 'staff.removed', `Removed ${m.name}`); return { ok: true, message: 'Removed. They can no longer sign in.' }; },
  async activity(q) { const x = await S(); const all = x.activity.filter(e => (!q?.actor || e.actor === q.actor) && (!q?.before || e.id < q.before)); return { items: all.slice(0, 30), hasMore: all.length > 30 }; },
  async changePassword(current, next) { if (next.length < 10) return { ok: false, message: 'Use at least 10 characters.' }; if (next === current) return { ok: false, message: 'Choose a password you have not used before.' }; return { ok: true, message: 'Password changed. (Demo: nothing is stored.)' }; },
  async rollbackTheme(v) { return okDemo(`Rollback to v${v} requested.`); },
  async decideGrant(id, dec) {
    const x = await S(); const g = x.grants.find(q => q.id === id); if (!g) return { ok: false, message: 'That request no longer exists.' };
    g.state = dec === 'approve' ? 'active' : 'revoked'; return { ok: true, message: dec === 'approve' ? `Access approved until ${new Date(g.expires).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Everything they do is logged.` : dec === 'decline' ? 'Request declined.' : 'Access revoked immediately.' };
  },
  async savePreferences() { return okDemo('Preferences saved.'); },
  async product(id) { const x = await S(); const p = x.products.find(q => q.id === id); if (!p) return null; const d = detail(x, p); const m = metaOf(x, p); return { ...p, imageUrl: m.images[0]?.url ?? p.imageUrl, optionGroups: d.groups, variantList: d.list, description: m.description, handle: m.handle, seoTitle: m.seoTitle, seoDescription: m.seoDescription, images: m.images } as ProductDetail; },
  async saveVariants(productId, d) {
    const x = await S(); const p = x.products.find(q => q.id === productId); if (!p) return { ok: false, message: 'Product not found.' };
    const problems = validateDraft({ title: p.title, optionGroups: d.optionGroups, variants: d.variants }); if (problems.length) return { ok: false, message: problems[0] };
    const taken = x.products.filter(q => q.id !== productId).flatMap(q => detail(x, q).list.map(v => v.sku)); const clash = d.variants.find(v => taken.includes(v.sku)); if (clash) return { ok: false, message: `SKU ${clash.sku} is used by another product.` };
    const old = detail(x, p).list; const next: Variant[] = d.variants.map((v, i) => { const o = old.find(q => q.sku === v.sku); const onHand = v.stock; if (o && onHand < o.allocated) throw new Error(`${v.sku}: ${o.allocated} are reserved for open orders, so stock cannot go below that.`); return { id: o?.id ?? `${productId}n${Date.now().toString(36)}${i}`, options: v.options, sku: v.sku, priceMinor: v.priceMinor, onHand, allocated: o?.allocated ?? 0, taxClass: v.taxClass, enabled: v.enabled, weightGrams: v.weightGrams }; });
    x.variants[productId] = { groups: d.optionGroups, list: next }; const on = next.filter(v => v.enabled);
    p.onHand = next.reduce((a, v) => a + v.onHand, 0); p.allocated = next.reduce((a, v) => a + v.allocated, 0); p.variants = next.length; p.priceMinor = on.length ? Math.min(...on.map(v => v.priceMinor)) : p.priceMinor; p.sku = next[0]?.sku ?? p.sku;
    return { ok: true, message: `${next.length} variant${next.length > 1 ? 's' : ''} saved. Total in stock: ${p.onHand}.` };
  },
  async previewCollection(contains) { const x = await S(); const t = contains.trim().toLowerCase(); if (!t) return { count: 0, products: [] }; const hit = x.products.filter(p => p.status === 'published').flatMap(p => detail(x, p).list.filter(v => `${p.title} ${v.options.join(' ')}`.toLowerCase().includes(t)).map(() => p.title)); return { count: hit.length, products: [...new Set(hit)] }; },
  async collections() {
    const x = await S();
    return Promise.all(x.collections.map(async c => {
      if (c.productIds?.length) { const ps = x.products.filter(p => c.productIds!.includes(p.id)); return { id: c.id, name: c.name, kind: 'manual', contains: '', productIds: c.productIds, count: ps.reduce((n, p) => n + detail(x, p).list.length, 0), products: ps.map(p => p.title) } as Collection; }
      const r = await demoGateway.previewCollection(c.contains); return { id: c.id, name: c.name, kind: 'rule', contains: c.contains, count: r.count, products: r.products } as Collection;
    }));
  },
  async saveCollection(c) {
    const x = await S(); const name = c.name.trim(); if (!name) return { ok: false, message: 'Give the collection a name.' }; if (name.length > 80) return { ok: false, message: 'Keep the name under 80 characters.' };
    if (x.collections.some(o => o.id !== c.id && o.name.toLowerCase() === name.toLowerCase())) return { ok: false, message: `A collection called ${name} already exists.` };
    let rec: { id: string; name: string; contains: string; productIds?: string[] }; let count = 0;
    if (c.kind === 'rule') { const term = (c.contains ?? '').trim(); if (!term) return { ok: false, message: 'Add a word to match.' }; const r = await demoGateway.previewCollection(term); count = r.count; rec = { id: c.id ?? `c${Date.now().toString(36)}`, name, contains: term }; }
    else { if (!c.productIds?.length) return { ok: false, message: 'Choose at least one product.' }; const ps = x.products.filter(p => c.productIds!.includes(p.id)); if (ps.length !== new Set(c.productIds).size) return { ok: false, message: 'One of the chosen products is not in your catalogue.' }; count = ps.reduce((n, p) => n + detail(x, p).list.length, 0); rec = { id: c.id ?? `c${Date.now().toString(36)}`, name, contains: '', productIds: c.productIds }; }
    if (!count) return { ok: false, message: 'Nothing matches that yet. A collection with no products would show an empty page on your website.' };
    const i = c.id ? x.collections.findIndex(o => o.id === c.id) : -1; if (c.id && i < 0) return { ok: false, message: 'That collection no longer exists.' }; if (i >= 0) x.collections[i] = rec; else x.collections.push(rec);
    return { ok: true, id: rec.id, message: c.id ? `${name} saved.` : `${name} created with ${count} variant${count > 1 ? 's' : ''}.` };
  },
  async deleteCollection(id) { const x = await S(); const i = x.collections.findIndex(o => o.id === id); if (i < 0) return { ok: false, message: 'That collection no longer exists.' }; x.collections.splice(i, 1); return { ok: true, message: 'Collection deleted. The products themselves are untouched.' }; },
  async createCollection(name, contains) {
    const x = await S(); if (x.collections.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) return { ok: false, message: `A collection called ${name.trim()} already exists.` }; const r = await demoGateway.previewCollection(contains);
    if (!r.count) return { ok: false, message: 'Nothing matches that rule yet. A collection with no products would show an empty page on your website.' };
    x.collections.push({ id: `c${Date.now().toString(36)}`, name: name.trim(), contains: contains.trim() }); return { ok: true, message: `${name.trim()} created with ${r.count} variant${r.count > 1 ? 's' : ''} from ${r.products.length} product${r.products.length > 1 ? 's' : ''}.` };
  },
  async notices() {
    const st = await state(); const x = await S(); const out: Notice[] = []; if (st === 'new') return out;
    for (const o of x.orders.filter(q => q.payment === 'failed').slice(0, 3)) out.push({ id: `pay-${o.id}`, tone: 'danger', kind: 'payment', title: `Payment failed on order #${o.number}`, body: `${o.customer}'s card was declined. No charge was made, so there is nothing to refund.`, href: `/orders/${o.id}`, action: 'View order', at: o.placedAt, read: false });
    const pay = await demoGateway.paymentSetup(); if (['restricted', 'disconnected', 'payouts_paused', 'action_required'].includes(pay.status)) out.push({ id: `acct-${pay.status}`, tone: pay.status === 'action_required' ? 'warn' : 'danger', kind: 'payment', title: pay.headline, body: pay.detail, href: '/settings/payments', action: 'Open payments', at: AS_OF, read: false });
    const open = x.orders.filter(q => q.state === 'open' && q.payment === 'paid'); if (open.length) out.push({ id: `ship-${open.length}`, tone: 'warn', kind: 'order', title: `${open.length} order${open.length > 1 ? 's' : ''} waiting to ship`, body: `The oldest was placed ${new Date(open[open.length - 1].placedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Customers are told when you mark an order fulfilled.`, href: '/orders?filter=unfulfilled', action: 'Review orders', at: open[0].placedAt, read: false });
    for (const p of x.products.filter(q => q.status === 'published' && q.onHand - q.allocated <= q.threshold).slice(0, 2)) out.push({ id: `stock-${p.id}-${p.onHand}`, tone: 'warn', kind: 'stock', title: `${p.title} is running low`, body: `${Math.max(p.onHand - p.allocated, 0)} available, and your alert level is ${p.threshold}.`, href: '/inventory', action: 'Adjust stock', at: AS_OF, read: false });
    for (const g of x.grants.filter(q => q.state === 'pending')) out.push({ id: `grant-${g.id}`, tone: 'info', kind: 'access', title: `${g.who} is asking for access`, body: g.purpose + '. Nothing is shared until you approve.', href: '/settings/team', action: 'Review request', at: AS_OF, read: false });
    for (const r of x.requests.filter(q => q.status === 'quoted')) out.push({ id: `quote-${r.id}`, tone: 'info', kind: 'quote', title: 'A quote is ready', body: `${r.title}. Nothing is built or billed until you approve it.`, href: '/support', action: 'View quote', at: r.createdAt, read: false });
    if (st === 'setup') out.push({ id: 'domain', tone: 'info', kind: 'setup', title: 'Verify your domain to launch', body: 'Add the DNS record we show you. Apple Pay and Google Pay also need it.', href: '/storefront', action: 'Check domain', at: AS_OF, read: false });
    return out.map(n => ({ ...n, read: x.read.has(n.id) })).sort((a, b) => Number(a.read) - Number(b.read) || b.at.localeCompare(a.at));
  },
  async markNoticesRead(ids) { const x = await S(); const all = ids === 'all' ? (await demoGateway.notices()).map(n => n.id) : ids; all.forEach(i => x.read.add(i)); return { ok: true, message: all.length > 1 ? 'All caught up.' : 'Marked as read.' }; },
  async addProduct(p) {
    const x = await S(); const sku = (p.sku || p.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 8).toUpperCase()).toUpperCase();
    if (x.products.some(q => q.sku === sku)) return { ok: false, message: `SKU ${sku} is already used by another product.` };
    if (p.compareAtMinor && p.compareAtMinor <= p.priceMinor) return { ok: false, message: 'The compare-at price must be higher than the price.' };
    const id = `p${Date.now().toString(36)}`; x.products.unshift({ id, title: p.title.trim(), status: p.status, sku, priceMinor: p.priceMinor, onHand: p.onHand, allocated: 0, threshold: 5, variants: 1 });
    x.variants[id] = { groups: [], list: [{ id: `${id}v0`, options: [], sku, priceMinor: p.priceMinor, onHand: p.onHand, allocated: 0, taxClass: p.taxClass ?? 'standard', enabled: true, weightGrams: p.weightGrams, compareAtMinor: p.compareAtMinor, barcode: p.barcode }] };
    x.meta[id] = { description: p.description ?? '', handle: (p.handle || p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '', images: [] };
    return { ok: true, id, message: p.status === 'published' ? `${p.title} is published.` : `${p.title} saved as a draft.` };
  },
  async updateProduct(id, e) {
    const x = await S(); const p = x.products.find(q => q.id === id); if (!p) return { ok: false, message: 'Product not found.' }; if (!e.title.trim()) return { ok: false, message: 'A product needs a name.' };
    const handle = (e.handle || e.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (x.products.some(q => q.id !== id && x.meta[q.id]?.handle === handle)) return { ok: false, message: `The web address "${handle}" is already used by another product.` };
    p.title = e.title.trim(); p.status = e.status; Object.assign(metaOf(x, p), { description: e.description, handle, seoTitle: e.seoTitle.trim(), seoDescription: e.seoDescription.trim() });
    return { ok: true, message: e.status === 'published' ? 'Saved. This product is on your store.' : 'Saved as a draft. It is hidden from your store.' };
  },
  async deleteProduct(id) {
    const x = await S(); const i = x.products.findIndex(q => q.id === id); if (i < 0) return { ok: false, message: 'Product not found.' };
    if (x.orders.some(o => o.lines.some(l => l.sku === x.products[i].sku && o.state === 'open'))) return { ok: false, message: 'This product is on an open order. Fulfil or cancel those orders first, or set it to draft to hide it.' };
    x.products.splice(i, 1); delete x.variants[id]; delete x.meta[id]; return { ok: true, message: 'Product deleted.' };
  },
  async uploadProductImages(id, files) {
    const x = await S(); const p = x.products.find(q => q.id === id); if (!p) return { ok: false, message: 'Product not found.' }; const m = metaOf(x, p); const problems: string[] = []; let added = 0;
    for (const f of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { problems.push(`${f.name} is not a JPEG, PNG or WebP photo`); continue; }
      if (f.bytes.length === 0 || f.bytes.length > 3_000_000) { problems.push(`${f.name} is over 3 MB (the demo keeps photos in memory)`); continue; }
      m.images.push({ id: `i${Date.now().toString(36)}${m.images.length}${added}`, name: f.name, url: `data:${f.type};base64,${Buffer.from(f.bytes).toString('base64')}` }); added++;
    }
    return added ? { ok: true, message: `${added} photo${added > 1 ? 's' : ''} added${problems.length ? `. ${problems.join('. ')}.` : ''}` } : { ok: false, message: problems.join('. ') || 'No photos were added.' };
  },
  async setProductImages(id, ordered) {
    const x = await S(); const p = x.products.find(q => q.id === id); if (!p) return { ok: false, message: 'Product not found.' }; const m = metaOf(x, p); const by = new Map(m.images.map(i => [i.id, i]));
    const next = ordered.map(i => by.get(i)).filter((i): i is NonNullable<typeof i> => !!i); const gone = m.images.length - next.length; m.images = next; return { ok: true, message: gone ? `Photos updated. ${gone} removed.` : 'Photo order saved.' };
  },
  async importProducts(rows) {
    const x = await S(); let added = 0, skipped = 0; for (const r of rows) { const sku = (r.sku || r.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 8)).toUpperCase(); if (!r.title || x.products.some(q => q.sku === sku)) { skipped++; continue; } x.products.push({ id: `p${Date.now().toString(36)}${added}`, title: r.title, status: r.status, sku, priceMinor: r.priceMinor, onHand: r.onHand, allocated: 0, threshold: 5, variants: 1 }); added++; }
    return added ? { ok: true, message: `${added} product${added > 1 ? 's' : ''} imported${skipped ? `. ${skipped} skipped (duplicate or empty SKU/title)` : ''}.` } : { ok: false, message: 'Nothing was imported. Every row was empty or used an existing SKU.' };
  },
  async adjustStock(a) {
    const x = await S(); const p = x.products.find(q => q.id === a.productId); if (!p) return { ok: false, message: 'Product not found.' };
    const to = a.mode === 'set' ? a.qty : p.onHand + a.qty; if (to < 0) return { ok: false, message: `That would take stock below zero (you have ${p.onHand}).` }; if (to < p.allocated) return { ok: false, message: `${p.allocated} are reserved for open orders, so stock cannot go below that.` };
    const from = p.onHand; p.onHand = to; x.stockLog.unshift({ at: new Date().toISOString(), product: p.title, from, to, reason: a.reason });
    return { ok: true, message: `${p.title}: ${from} to ${to} on hand. Logged as ${a.reason}.` };
  },
  async createDiscount(d) {
    const x = await S(); const code = d.code.trim().toUpperCase(); if (x.discounts.some(q => q.code === code)) return { ok: false, message: `The code ${code} already exists.` };
    x.discounts.unshift({ id: `d${Date.now().toString(36)}`, code, name: `${code} discount`, kind: d.kind, value: d.value, status: 'active', used: 0, limit: d.limit, window: d.endDate ? `Ends ${new Date(d.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No end date', minSpendMinor: d.minSpendMinor });
    return { ok: true, message: `${code} is live. Customers can use it at checkout now.` };
  },
  async discountProducts() { const x = await S(); return x.products.filter(p => p.status !== 'archived').map(p => ({ id: p.id, title: p.title, variantIds: detail(x, p).list.map(v => v.id) })); },
  async saveDiscount(d) {
    const x = await S(); const problem = validateDiscount(d, AS_OF.slice(0, 10)); if (problem) return { ok: false, message: problem };
    const code = d.method === 'code' ? (d.code ?? '').trim().toUpperCase() : ''; if (code && x.discounts.some(q => q.id !== d.id && q.code === code)) return { ok: false, message: `${code} is already in use.` };
    if (d.productIds?.some(id => !x.products.some(p => p.id === id))) return { ok: false, message: 'One of the chosen products is not in your catalogue.' };
    const startsAt = d.startDate ? `${d.startDate}T00:00:00.000Z` : undefined; const endsAt = d.endDate ? `${d.endDate}T23:59:59.999Z` : undefined; const now = new Date(AS_OF);
    const sd = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const prev = d.id ? x.discounts.find(q => q.id === d.id) : undefined; if (d.id && !prev) return { ok: false, message: 'That discount no longer exists.' };
    const row: Discount = { id: d.id ?? `d${Date.now().toString(36)}`, code, automatic: !code, name: d.name?.trim() || (code ? `${code} discount` : 'Automatic discount'), kind: d.kind, value: d.value, used: prev?.used ?? 0, limit: d.limit, perCustomer: d.perCustomer, minSpendMinor: d.minSpendMinor || undefined, productIds: d.productIds?.length ? d.productIds : undefined, buy: d.buy, get: d.get, startsAt, endsAt,
      status: statusOf({ enabled: d.enabled, startsAt, endsAt }, now), window: startsAt && new Date(startsAt) > now ? `Starts ${sd(startsAt)}${endsAt ? `, ends ${sd(endsAt)}` : ''}` : endsAt ? (new Date(endsAt) <= now ? `Ended ${sd(endsAt)}` : `Ends ${sd(endsAt)}`) : 'No end date' };
    if (prev) Object.assign(prev, row); else x.discounts.unshift(row);
    return { ok: true, id: row.id, message: d.id ? 'Discount saved.' : code ? `${code} is ${d.enabled ? 'active' : 'saved as paused'}.` : `The automatic discount is ${d.enabled ? 'active' : 'saved as paused'}.` };
  },
  async setDiscountEnabled(id, enabled) {
    const x = await S(); const d = x.discounts.find(q => q.id === id); if (!d) return { ok: false, message: 'That discount no longer exists.' }; if (d.status === 'expired') return { ok: false, message: 'This discount has ended. Edit its dates to run it again.' };
    d.status = enabled ? (d.startsAt && new Date(d.startsAt) > new Date(AS_OF) ? 'scheduled' : 'active') : 'paused';
    return { ok: true, message: enabled ? 'Discount resumed. Customers can use it again.' : 'Discount paused. Customers cannot use it until you resume it.' };
  },
  async deleteDiscount(id) { const x = await S(); const i = x.discounts.findIndex(q => q.id === id); if (i < 0) return { ok: false, message: 'That discount no longer exists.' }; x.discounts.splice(i, 1); return { ok: true, message: 'Discount deleted. Past orders keep what they were charged.' }; },
  async saveZone(z) {
    const x = await S(); const name = z.name.trim(); const i = z.originalName ? x.zones.findIndex(q => q.name === z.originalName) : -1;
    if (x.zones.some((q, k) => q.name.toLowerCase() === name.toLowerCase() && k !== i)) return { ok: false, message: `A zone called ${name} already exists.` };
    if (!z.rates.length) return { ok: false, message: 'Add at least one delivery option.' };
    for (const r of z.rates) { const bad = validateRate(r); if (bad) return { ok: false, message: bad }; }
    const sp = splitRegions(z.regions, [{ code: 'GB', name: 'United Kingdom', enabled: true }, { code: 'IE', name: 'Ireland', enabled: true }, { code: 'US', name: 'United States', enabled: true }, { code: 'FR', name: 'France', enabled: true }, { code: 'DE', name: 'Germany', enabled: true }]); if (sp.unknown.length) return { ok: false, message: `We could not match ${sp.unknown.join(', ')}. Use country names, or UK postcode areas such as IV, a range such as PA20–80, or an outward code such as SW1A.` };
    const zone = { name, regions: z.regions.trim(), rates: z.rates }; if (i >= 0) x.zones[i] = zone; else x.zones.push(zone); return { ok: true, message: i >= 0 ? `${name} updated.` : `${name} added. Customers there can now check out.` };
  },
  async checkDomain() {
    const x = await S(); x.domainChecks++; const rec = { type: 'CNAME', name: 'shop', value: 'cname.oss-commerce.example' };
    return x.domainChecks < 3 ? { ok: false, message: 'We cannot see the DNS record yet. Changes can take up to an hour to spread. Check again in a few minutes.', record: rec } : { ok: true, message: 'Domain verified. We are issuing the SSL certificate now.' };
  },
  async requestLaunch() {
    const x = await S(); if (x.launchRequested) return { ok: false, message: 'You have already requested launch. We will be in touch.' };
    x.launchRequested = true; return { ok: true, message: 'Launch requested. We will run the final checks and confirm within one working day.' };
  },
};
