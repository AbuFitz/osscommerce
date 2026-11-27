import 'server-only';
import { LAUNCH_PLAN } from '@oss-commerce/contracts';
import { GATE_COPY, LAUNCH_GATES, ROLE_INFO, type Member, type Viewer, type CommerceGateway, type MutationResult, type Notice, type Order, type Preferences, type Summary } from '../gateway';
import { createCollection as engineCreateCollection, previewCollection as enginePreview, type Exec } from './catalogue';
import * as A from './adapter';
import type { ControlPlanePort } from '../control-plane';
import { launchBlockers, withTestOrder } from '../launch-readiness';

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
export function engineGateway(exec: () => Promise<Exec>, meta: StoreMeta, control?: ControlPlanePort | null, setCheckoutPaused?: (paused: boolean) => Promise<MutationResult>): CommerceGateway {
  const x: Exec = Object.assign(async (q: string, v?: Record<string, unknown>) => (await exec())(q, v), { upload: async (q: string, v: Record<string, unknown>, files: Parameters<NonNullable<Exec['upload']>>[2]) => { const e = await exec(); if (!e.upload) throw new Error('Photo upload is not available for this store yet.'); return e.upload(q, v, files); } });
  const lowStockOf = async () => (await A.listProducts(x)).filter(p => p.status === 'published' && p.onHand - p.allocated <= p.threshold).length;
  const storeView = async () => {
    if (!control) return { name: meta.name, store: { storeId: meta.storeId, organisationId: meta.storeId, cellId: 'cell', hostnames: [{ host: meta.host ?? '', verified: false }], region: 'eu-west-london', lifecycle: 'configuring', entitlementVersion: 1, paymentReadiness: 'not_started' } as never, readiness: LAUNCH_GATES.map(g => ({ gate: g, done: false, ...GATE_COPY[g] })) };
    const result = { name: meta.name, ...(await control.store(meta.storeId, meta.name)) };
    result.readiness = withTestOrder(result.readiness, await A.listOrders(x));
    return result;
  };
  return {
    async viewer() { const r = await x('query{ activeAdministrator{ firstName lastName emailAddress } myRole }'); const a = r.activeAdministrator; const name = `${a?.firstName ?? ''} ${a?.lastName ?? ''}`.trim() || a?.emailAddress || 'Signed in'; const kind = (ROLE_INFO[r.myRole as Viewer['kind']] ? r.myRole : 'analyst') as Viewer['kind']; return { name, initials: name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(), role: ROLE_INFO[kind].label, kind }; },
    store: storeView,
    async summary() { return summarise(await A.listOrders(x), await lowStockOf()); },
    async live() { return A.liveView(x); },
    async billing() { return control ? control.billing(meta.storeId) : { demo: false, planName: LAUNCH_PLAN.name, monthlyMinor: LAUNCH_PLAN.monthlyMinor, buildMinor: LAUNCH_PLAN.buildFromMinor, status: 'not_started', invoices: [] }; },
    async startBillingPortal() { return control ? control.startBillingPortal(meta.storeId) : { ok: false, message: 'Billing management is not connected for your store yet.' }; },
    orders: q => A.listOrders(x, q), reportOrders: from => A.reportOrders(x, from), order: id => A.getOrder(x, id), products: () => A.listProducts(x), product: id => A.getProduct(x, id), customers: () => A.listCustomers(x),
    addProduct: p => A.addProduct(x, p), stockRows: () => A.listStockRows(x), stockDetail: id => A.getStockDetail(x, id), stockMoves: (id, page) => A.getStockMoves(x, id, page), adjustVariantStock: a => A.adjustVariantStock(x, a), saveStockSettings: (id, s) => A.saveStockSettings(x, id, s), applyStockCount: (l, by, n) => A.applyStockCount(x, l, by, n), orderableItems: () => A.listOrderableItems(x), shippingChoices: () => A.listShippingChoices(x), createManualOrder: i => A.createManualOrder(x, i), customer: id => A.getCustomer(x, id), addCustomerNote: (id, t) => A.addCustomerNote(x, id, t), deleteCustomerNote: (_c, n) => A.deleteCustomerNote(x, n), updateCustomerProfile: (id, p) => A.updateCustomerProfile(x, id, p), discountProducts: () => A.listDiscountProducts(x), saveDiscount: d => A.saveDiscount(x, d), setDiscountEnabled: (id, e) => A.setDiscountEnabled(x, id, e), deleteDiscount: id => A.deleteDiscount(x, id), updateProduct: (id, e) => A.updateProduct(x, id, e), deleteProduct: id => A.deleteProduct(x, id), uploadProductImages: (id, f) => A.uploadProductImages(x, id, f), setProductImages: (id, o) => A.setProductImages(x, id, o), adjustStock: a => A.adjustStock(x, a), saveVariants: (id, d) => A.saveVariants(x, id, d), fulfilOrder: (id, t, l) => A.fulfilOrder(x, id, t, l), cancelOrder: i => A.cancelOrder(x, i), addOrderNote: (id, n) => A.addOrderNote(x, id, n), refundOrder: i => A.refundOrder(x, i), previewOrderEdit: i => A.previewOrderEdit(x, i), applyOrderEdit: i => A.applyOrderEdit(x, i), resolveOrderEdit: (id, pay) => A.resolveOrderEdit(x, id, pay), abandonedCheckouts: () => A.listAbandoned(x),
    async importProducts(rows) { let added = 0; const problems: string[] = []; for (const r of rows) { const res = await A.addProduct(x, r); if (res.ok) added++; else problems.push(res.message); } return added ? { ok: true, message: `${added} product${added > 1 ? 's' : ''} imported${problems.length ? `. ${problems.length} skipped: ${problems[0]}` : ''}.` } : { ok: false, message: problems[0] ?? 'Nothing was imported.' }; },
    collections: () => A.listCollections(x), saveCollection: c => A.saveCollection(x, c), deleteCollection: id => A.deleteCollection(x, id),
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
    async discounts() { return A.listDiscounts(x); }, async team() { const me = (await x('query{ activeAdministrator{ emailAddress } }')).activeAdministrator?.emailAddress ?? ''; const v = await this.viewer(); let members: Member[]; try { members = await A.listStaff(x, me); } catch { members = [{ name: v.name, email: me, role: v.kind, status: 'active', self: true }]; } return { members, grants: control ? await control.grants(meta.storeId) : [] }; },
    async storefront() { return (control && await control.storefront(meta.storeId)) ?? { theme: { name: 'Your storefront', version: '0', deployedAt: new Date().toISOString(), state: 'building' }, previewUrl: '#', liveUrl: null, checks: [], history: [] }; },
    async shippingTax() { const s = await A.listShippingTax(x); return { ...s, vatRegistered: null, payments: { account: '', capabilities: [], applicationFeeBp: LAUNCH_PLAN.fee.baseBp, payouts: '' } }; },
    async paymentSetup() { return control ? control.payment(meta.storeId, LAUNCH_PLAN.fee.baseBp) : { status: 'unknown', headline: 'Payment status is not available yet', detail: 'We are connecting payments for your store. Contact us if you expected this to be ready.', chargesEnabled: false, payoutsEnabled: false, checkoutAllowed: false, actionRequired: false, due: [], pending: [], applicationFeeBp: LAUNCH_PLAN.fee.baseBp }; },
    async startPaymentSetup() { return control ? control.startPaymentSetup(meta.storeId) : { ok: false, message: 'Payment set-up is not connected for your store yet. Contact us and we will set it up with you.' }; },
    async content() { return control ? control.content(meta.storeId, meta.name) : { page: { id: 'home', title: 'Home', path: '/' }, sections: [], publishedAt: '', previewUrl: '#', versions: [] }; },
    async menus() { return control ? control.menus(meta.storeId) : []; }, async sitePages() { return control ? control.sitePages(meta.storeId) : []; },
    saveMenu: (k, items, pub) => control ? control.saveMenu(meta.storeId, k, items, pub) : no(), saveSitePage: (pg, pub, isNew) => control ? control.saveSitePage(meta.storeId, pg, pub, isNew) : no(), deleteSitePage: slug => control ? control.deleteSitePage(meta.storeId, slug) : no(),
    async legalPages() { return control ? control.legalPages(meta.storeId) : []; }, async automations() { return control ? control.automations(meta.storeId) : { rules: [], runs: [], runsLimit: 0 }; }, async serviceRequests() { return control ? control.serviceRequests(meta.storeId) : []; },
    async emailSettings() { return control ? control.emailSettings(meta.storeId, meta.name) : { brand: { shopName: meta.name, accent: '#0e1311', supportEmail: '', footer: '' }, notifications: {}, sendingDomain: { host: '', verified: false } }; },
    async preferences() { if (!control) throw new Error('Control plane is not configured.'); return control.preferences(meta.storeId); },
    saveSection: (id, fields) => control ? control.saveSection(meta.storeId, meta.name, id, fields) : no(), publishContent: () => control ? control.publishContent(meta.storeId, meta.name) : no(), saveLegal: (slug, body, publish) => control ? control.saveLegal(meta.storeId, slug, body, publish) : no(),
    setAutomation: (id, enabled) => control ? control.setAutomation(meta.storeId, id, enabled) : no(),
    createServiceRequest: (kind, title, detail) => control ? control.createServiceRequest(meta.storeId, kind, title, detail) : no(), decideQuote: (id, approve) => control ? control.decideQuote(meta.storeId, id, approve) : no(),
    saveEmailSettings: (brand, notifications) => control ? control.saveEmailSettings(meta.storeId, brand, notifications) : no(),
    tradePricing: () => A.getTradePricing(x), saveTradePricing: (p, e) => A.saveTradePricing(x, p, e), setTradeCustomer: (c, m) => A.setTradeCustomer(x, c, m), reviews: st => A.listReviews(x, st), moderateReview: (id, st) => A.moderateReview(x, id, st), replyToReview: (id, r) => A.replyToReview(x, id, r), deleteReview: id => A.deleteReview(x, id), customerSegments: () => A.listSegments(x), saveSegment: i => A.saveSegment(x, i), deleteSegment: id => A.deleteSegment(x, id), customerExport: id => A.exportCustomer(x, id), eraseCustomer: id => A.eraseCustomer(x, id), inviteMember: i => A.inviteStaff(x, i), setMemberRole: (id, r) => A.setStaffRole(x, id, r), removeMember: id => A.removeStaff(x, id), resendInvite: id => A.resendStaffInvite(x, id), activity: q => A.listActivity(x, q), changePassword: (c, n) => A.changePassword(x, c, n), rollbackTheme: no, decideGrant: (id, decision) => control ? control.decideGrant(meta.storeId, id, decision) : no(),
    async savePreferences(p: Preferences) {
      if (!control || !setCheckoutPaused) return no();
      if (Object.keys(p).length !== 6 || !Object.values(p).every(value => typeof value === 'boolean')) return { ok: false, message: 'Preferences were invalid. Nothing was changed.' };
      const current = await control.preferences(meta.storeId);
      if (current.pause !== p.pause) { const synced = await setCheckoutPaused(p.pause); if (!synced.ok) return synced; }
      try {
        const saved = await control.savePreferences(meta.storeId, p);
        if (!saved.ok && current.pause !== p.pause) await setCheckoutPaused(current.pause);
        return saved;
      } catch (error) {
        if (current.pause !== p.pause) await setCheckoutPaused(current.pause);
        throw error;
      }
    },
    createDiscount: d => A.createDiscount(x, d), saveZone: z => A.saveShippingZone(x, z),
    async requestLaunch() { if (!control) return no(); const blockers = launchBlockers((await storeView()).readiness); if (blockers.length) return { ok: false, message: `Finish ${blockers.map(item => item.label.toLowerCase()).join(', ')} before requesting launch.` }; return control.requestLaunch(meta.storeId); },
    async checkDomain() { return control ? control.checkDomain(meta.storeId) : { ok: false, message: 'Domain verification is not configured for your store yet.' }; },
  };
}
