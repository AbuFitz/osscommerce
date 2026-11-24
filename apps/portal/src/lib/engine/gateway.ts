import 'server-only';
import { LAUNCH_PLAN } from '@oss-commerce/contracts';
import { GATE_COPY, LAUNCH_GATES, type CommerceGateway, type MutationResult, type Notice, type Order, type Summary } from '../gateway';
import { createCollection as engineCreateCollection, previewCollection as enginePreview, type Exec } from './catalogue';
import * as A from './adapter';
import type { ControlPlanePort } from '../control-plane';

const NOT_YET: MutationResult = { ok: false, message: 'This part is not connected for your store yet. Nothing was changed.' };
const no = async () => NOT_YET;
const day = (iso: string) => iso.slice(0, 10);

/** Sales figures computed from the engine's own orders, so they always agree with the Orders page. */
export function summarise(orders: Order[], lowStock: number, now = new Date()): Summary {
  const paid = orders.filter(o => o.payment === 'paid' || o.payment === 'partially_refunded' || o.payment === 'refunded'); const gross = paid.reduce((s, o) => s + o.totalMinor, 0); const refunded = paid.reduce((s, o) => s + o.refundedMinor, 0);
  const series = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - (13 - i)); const k = d.toISOString().slice(0, 10); const of = paid.filter(o => day(o.placedAt) === k); const g = of.reduce((s, o) => s + o.totalMinor, 0); return { day: k, grossMinor: g, netMinor: g - of.reduce((s, o) => s + o.refundedMinor, 0) }; });
  const by = new Map<string, number>(); for (const o of paid) for (const l of o.lines) by.set(l.title, (by.get(l.title) ?? 0) + l.qty * l.unitMinor);
  const count = (f: (o: Order) => boolean) => orders.filter(f).length;
  return { netMinor: gross - refunded, grossMinor: gross, orders: paid.length, aovMinor: paid.length ? Math.round(gross / paid.length) : 0, refundedMinor: refunded, toFulfil: count(o => o.state === 'open' && o.payment === 'paid'), fulfilled: count(o => o.state === 'completed'), paidOrders: paid.length, lowStock, series,
    topProducts: [...by].map(([title, netMinor]) => ({ title, netMinor })).sort((a, b) => b.netMinor - a.netMinor).slice(0, 5),
    statusMix: [{ label: 'Fulfilled', count: count(o => o.state === 'completed') }, { label: 'To fulfil', count: count(o => o.state === 'open') }, { label: 'Cancelled', count: count(o => o.state === 'cancelled') }], asOf: now.toISOString() };
}

export interface StoreMeta { storeId: string; name: string; host?: string }
/**
 * The live gateway. Orders, products, variants, stock, customers, collections, fulfilment and refunds go to the merchant's engine cell
 * with the signed-in merchant's own session. Areas whose backing service is not connected yet return empty, honest states and refuse
 * changes with a clear message. They never return fixtures.
 */
export function engineGateway(exec: () => Promise<Exec>, meta: StoreMeta, control?: ControlPlanePort | null): CommerceGateway {
  const x: Exec = async (q, v) => (await exec())(q, v);
  const lowStockOf = async () => (await A.listProducts(x)).filter(p => p.status === 'published' && p.onHand - p.allocated <= p.threshold).length;
  return {
    async viewer() { const a = (await x('query{ activeAdministrator{ firstName lastName emailAddress } }')).activeAdministrator; const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || a?.emailAddress || 'Signed in'; return { name, initials: name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(), role: 'Store administrator' }; },
    async store() { if (control) return { name: meta.name, ...(await control.store(meta.storeId, meta.name)) }; return { name: meta.name, store: { storeId: meta.storeId, organisationId: meta.storeId, cellId: 'cell', hostnames: [{ host: meta.host ?? '', verified: false }], region: 'eu-west-london', lifecycle: 'configuring', entitlementVersion: 1, paymentReadiness: 'not_started' } as never, readiness: LAUNCH_GATES.map(g => ({ gate: g, done: false, ...GATE_COPY[g] })) }; },
    async summary() { return summarise(await A.listOrders(x), await lowStockOf()); },
    async live() { return { demo: false, asOf: new Date().toISOString(), visitorsNow: 0, sessions: { value: 0, vsPrev: 0 }, salesMinor: { value: 0, vsPrev: 0 }, orders: { value: 0, vsPrev: 0 }, behaviour: { activeCarts: 0, checkingOut: 0, purchased: 0 }, locations: [], returning: { newCustomers: 0, returning: 0 } }; },
    async billing() { return { demo: false, planName: LAUNCH_PLAN.name, monthlyMinor: LAUNCH_PLAN.monthlyMinor, buildMinor: LAUNCH_PLAN.buildFromMinor, status: 'not_started', invoices: [] }; },
    orders: q => A.listOrders(x, q), order: id => A.getOrder(x, id), products: () => A.listProducts(x), product: id => A.getProduct(x, id), customers: () => A.listCustomers(x),
    addProduct: p => A.addProduct(x, p), adjustStock: a => A.adjustStock(x, a), saveVariants: (id, d) => A.saveVariants(x, id, d), fulfilOrder: (id, t) => A.fulfilOrder(x, id, t), refundOrder: i => A.refundOrder(x, i),
    async importProducts(rows) { let added = 0; const problems: string[] = []; for (const r of rows) { const res = await A.addProduct(x, r); if (res.ok) added++; else problems.push(res.message); } return added ? { ok: true, message: `${added} product${added > 1 ? 's' : ''} imported${problems.length ? `. ${problems.length} skipped: ${problems[0]}` : ''}.` } : { ok: false, message: problems[0] ?? 'Nothing was imported.' }; },
    async collections() { const r = await x('query{ collections(options:{ take: 100 }){ items{ id name productVariants(options:{ take: 50 }){ totalItems items{ product{ name } } } } } }'); return (r.collections.items as any[]).map(c => ({ id: c.id, name: c.name, contains: '', count: c.productVariants.totalItems, products: [...new Set((c.productVariants.items as any[]).map(v => v.product.name as string))] })); },
    async previewCollection(contains) { if (!contains.trim()) return { count: 0, products: [] }; const r = await enginePreview(x, { kind: 'name', contains }); return { count: r.totalItems, products: [...new Set((r.items as { name: string }[]).map(i => i.name))] }; },
    async createCollection(name, contains) { try { const pre = await enginePreview(x, { kind: 'name', contains }); if (!pre.totalItems) return { ok: false, message: 'Nothing matches that rule yet. A collection with no products would show an empty page on your website.' }; await engineCreateCollection(x, name, { kind: 'name', contains }); return { ok: true, message: `${name.trim()} created with ${pre.totalItems} variant${pre.totalItems > 1 ? 's' : ''}.` }; } catch (e) { return { ok: false, message: e instanceof Error ? e.message : NOT_YET.message }; } },
    async notices() {
      const [orders, products] = await Promise.all([A.listOrders(x), A.listProducts(x)]); const out: Notice[] = []; const now = new Date().toISOString();
      for (const o of orders.filter(q => q.payment === 'failed').slice(0, 3)) out.push({ id: `pay-${o.id}`, tone: 'danger', kind: 'payment', title: `Payment failed on order #${o.number}`, body: `${o.customer}'s payment did not go through. No charge was made.`, href: `/orders/${o.id}`, action: 'View order', at: o.placedAt, read: false });
      const open = orders.filter(q => q.state === 'open' && q.payment === 'paid'); if (open.length) out.push({ id: `ship-${open.length}`, tone: 'warn', kind: 'order', title: `${open.length} order${open.length > 1 ? 's' : ''} waiting to ship`, body: 'Customers are told when you mark an order fulfilled.', href: '/orders?filter=unfulfilled', action: 'Review orders', at: open[0].placedAt, read: false });
      for (const p of products.filter(q => q.status === 'published' && q.onHand - q.allocated <= q.threshold).slice(0, 3)) out.push({ id: `stock-${p.id}-${p.onHand}`, tone: 'warn', kind: 'stock', title: `${p.title} is running low`, body: `${Math.max(p.onHand - p.allocated, 0)} available.`, href: '/inventory', action: 'Adjust stock', at: now, read: false });
      return out;
    },
    async markNoticesRead() { return { ok: true, message: 'Notifications clear on their own once the order or stock is dealt with.' }; },
    // ---- not connected yet: empty, honest states ----
    async discounts() { return A.listDiscounts(x); }, async team() { const v = await this.viewer(); return { members: [{ name: v.name, email: '', role: 'owner', status: 'active' }], grants: control ? await control.grants(meta.storeId) : [] }; },
    async storefront() { return (control && await control.storefront(meta.storeId)) ?? { theme: { name: 'Your storefront', version: '0', deployedAt: new Date().toISOString(), state: 'building' }, previewUrl: '#', liveUrl: null, checks: [], history: [] }; },
    async shippingTax() { const s = await A.listShippingTax(x); return { ...s, vatRegistered: null, payments: { account: '', capabilities: [], applicationFeeBp: LAUNCH_PLAN.fee.baseBp, payouts: '' } }; },
    async paymentSetup() { return control ? control.payment(meta.storeId, LAUNCH_PLAN.fee.baseBp) : { status: 'unknown', headline: 'Payment status is not available yet', detail: 'We are connecting payments for your store. Contact us if you expected this to be ready.', chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [], pending: [], applicationFeeBp: LAUNCH_PLAN.fee.baseBp }; },
    async startPaymentSetup() { return control ? control.startPaymentSetup(meta.storeId) : { ok: false, message: 'Payment set-up is not connected for your store yet. Contact us and we will set it up with you.' }; },
    async content() { return { page: { id: 'home', title: 'Home', path: '/' }, sections: [], publishedAt: '', previewUrl: '#', versions: [] }; },
    async legalPages() { return []; }, async automations() { return control ? control.automations(meta.storeId) : { rules: [], runs: [], runsLimit: 0 }; }, async serviceRequests() { return []; },
    async emailSettings() { return control ? control.emailSettings(meta.storeId, meta.name) : { brand: { shopName: meta.name, accent: '#0e1311', supportEmail: '', footer: '' }, notifications: {}, sendingDomain: { host: '', verified: false } }; },
    saveSection: no, publishContent: no, saveLegal: no,
    setAutomation: (id, enabled) => control ? control.setAutomation(meta.storeId, id, enabled) : no(),
    createServiceRequest: no, decideQuote: no,
    saveEmailSettings: (brand, notifications) => control ? control.saveEmailSettings(meta.storeId, brand, notifications) : no(),
    inviteMember: no, rollbackTheme: no, decideGrant: (id, decision) => control ? control.decideGrant(meta.storeId, id, decision) : no(), savePreferences: no, createDiscount: d => A.createDiscount(x, d), saveZone: z => A.saveShippingZone(x, z), requestLaunch: no,
    async checkDomain() { return { ok: false, message: 'Domain checks are not connected for your store yet.' }; },
  };
}
