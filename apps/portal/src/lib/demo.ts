import 'server-only';
import { cookies } from 'next/headers';
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


/** Demo-only view switch (cookie set by /demo). Lets reviewers see how the portal adapts: new store, setting up, live. */
export type DemoState = 'new' | 'setup' | 'live';
async function state(): Promise<DemoState> {
  try { const v = (await cookies()).get('oss_demo')?.value; return v === 'new' || v === 'live' ? v : 'setup'; } catch { return 'setup'; }
}
const ordersFor = (st: DemoState) => (st === 'new' ? [] : ORDERS);
const productsFor = (st: DemoState) => (st === 'new' ? [] : P);
const NOTE = ' Demo data: nothing was changed.';
const okDemo = (m: string) => ({ ok: true, message: m + NOTE });
export const demoGateway: CommerceGateway = {
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
  async summary(): Promise<Summary> {
    const st = await state(); const ALL = ordersFor(st);
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
      lowStock: productsFor(st).filter(p => p.status === 'published' && p.onHand - p.allocated <= p.threshold).length, series, topProducts,
      statusMix: [{ label: 'Fulfilled', count: count(o => o.state === 'completed') }, { label: 'To fulfil', count: count(o => o.state === 'open') }, { label: 'Cancelled', count: count(o => o.state === 'cancelled') }],
      asOf: AS_OF,
    };
  },
  async orders(q) {
    let r = ordersFor(await state());
    if (q?.filter === 'unfulfilled') r = r.filter(o => o.state === 'open');
    if (q?.filter === 'attention') r = r.filter(o => o.payment === 'failed' || o.payment === 'disputed');
    if (q?.filter === 'refunded') r = r.filter(o => o.refundedMinor > 0);
    if (q?.q) { const s = q.q.toLowerCase(); r = r.filter(o => `${o.number} ${o.customer} ${o.email}`.toLowerCase().includes(s)); }
    return r;
  },
  async order(id) { return ordersFor(await state()).find(o => o.id === id) ?? null; },
  async products() { return productsFor(await state()); },
  async customers() { return (await state()) === 'new' ? [] : CUSTOMERS; },
  async discounts() {
    return [
      { code: 'WELCOME10', kind: 'percent', value: 10, status: 'active', used: 14, limit: 200, window: 'No end date' },
      { code: 'FREESHIP50', kind: 'shipping', value: 0, status: 'active', used: 31, window: 'Until 31 Dec', minSpendMinor: 5000 },
      { code: 'BLACKFRIDAY', kind: 'percent', value: 20, status: 'scheduled', used: 0, limit: 500, window: '27–30 Nov' },
      { code: 'SUMMER5', kind: 'fixed', value: 500, status: 'expired', used: 88, limit: 100, window: 'Ended 31 Aug' },
    ];
  },
  async storefront() {
    return {
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
  async team() {
    return {
      members: [
        { name: 'Maya Okafor', email: 'maya@example.com', role: 'owner' as const, status: 'active' as const },
        { name: 'Tom Hendry', email: 'tom@example.com', role: 'fulfilment' as const, status: 'active' as const },
        { name: 'Priya Nair', email: 'priya@example.com', role: 'analyst' as const, status: 'invited' as const },
      ],
      grants: [
        { id: 'g1', who: 'OSS Support', purpose: 'Ticket 2041: checkout page error', scopes: ['Read orders'], write: false, state: 'pending' as const, expires: '2026-11-14T12:00:00Z' },
        { id: 'g2', who: 'OSS Engineering', purpose: 'Domain verification', scopes: ['Read settings'], write: false, state: 'active' as const, expires: '2026-11-15T09:00:00Z' },
      ],
    };
  },
  async shippingTax() {
    return {
      zones: [
        { name: 'United Kingdom', regions: 'England, Scotland, Wales, Northern Ireland', rates: [{ label: 'Standard, 2–4 days', priceMinor: 495, freeOverMinor: 5000 }, { label: 'Next day', priceMinor: 795 }] },
        { name: 'Highlands and Islands', regions: 'IV, KW, HS, ZE, PA20–80', rates: [{ label: 'Standard, 3–6 days', priceMinor: 895 }] },
      ],
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
    return {
      runsLimit: 1000,
      rules: [
        { id: 'a1', name: 'Order confirmation email', trigger: 'Order paid', action: 'Email the customer', kind: 'transactional' as const, enabled: true, runsMonth: 86, lastRun: '2026-11-14T08:12:00Z' },
        { id: 'a2', name: 'Dispatch email with tracking', trigger: 'Order fulfilled', action: 'Email the customer', kind: 'transactional' as const, enabled: true, runsMonth: 79, lastRun: '2026-11-14T07:40:00Z' },
        { id: 'a3', name: 'Low stock alert', trigger: 'Stock at alert level', action: 'Email you', kind: 'operational' as const, enabled: true, runsMonth: 6, lastRun: '2026-11-13T15:00:00Z' },
        { id: 'a4', name: 'Fulfilment reminder', trigger: 'Order unfulfilled for 48 hours', action: 'Email you', kind: 'operational' as const, enabled: false, runsMonth: 0 },
        { id: 'a5', name: 'Abandoned checkout reminder', trigger: 'Checkout left for 2 hours', action: 'Email the customer', kind: 'marketing' as const, enabled: false, runsMonth: 0, needsConsent: true },
      ],
      runs: [
        { id: 'r1', at: '2026-11-14T08:12:00Z', automation: 'Order confirmation email', event: 'Order #1042 paid', outcome: 'sent' as const, detail: 'Delivered to maya@example.com' },
        { id: 'r2', at: '2026-11-14T07:40:00Z', automation: 'Dispatch email with tracking', event: 'Order #1038 fulfilled', outcome: 'sent' as const, detail: 'Delivered to elena@example.com' },
        { id: 'r3', at: '2026-11-13T15:00:00Z', automation: 'Low stock alert', event: 'Serving bowl at 3 units', outcome: 'sent' as const, detail: 'Sent to you' },
        { id: 'r4', at: '2026-11-13T11:20:00Z', automation: 'Order confirmation email', event: 'Order #1036 paid', outcome: 'failed_retrying' as const, detail: 'Mailbox busy. Retrying in 10 minutes (attempt 2 of 5)' },
      ],
    };
  },
  async serviceRequests() {
    return [
      { id: 'sr1', kind: 'product_upload' as const, title: 'Upload 40 new products from my spreadsheet', status: 'quoted' as const, quoteMinor: 18000, createdAt: '2026-11-11T10:00:00Z', detail: 'CSV attached. Please add images from the shared folder.' },
      { id: 'sr2', kind: 'design_change' as const, title: 'Add a gift-wrapping option to the product page', status: 'in_progress' as const, quoteMinor: 24000, createdAt: '2026-11-03T14:30:00Z', detail: 'Optional extra at checkout.' },
      { id: 'sr3', kind: 'content' as const, title: 'Write descriptions for the winter range', status: 'done' as const, quoteMinor: 9500, createdAt: '2026-10-20T09:00:00Z', detail: '12 products.' },
    ];
  },
  async emailSettings() {
    return { brand: { shopName: 'Kiln & Thread', accent: '#2c3a15', supportEmail: 'hello@kilnandthread.example', footer: 'Thank you for supporting a small studio.' }, notifications: { newOrder: true, lowStock: true, paymentIssue: true, dailySummary: false }, sendingDomain: { host: 'mail.kilnandthread.example', verified: false } };
  },
  async saveSection() { return okDemo('Section saved as a draft.'); },
  async publishContent() { return okDemo('Published to your storefront.'); },
  async saveLegal(_s, _b, publish) { return okDemo(publish ? 'Page published.' : 'Draft saved.'); },
  async setAutomation(_id, on) { return okDemo(on ? 'Automation turned on.' : 'Automation turned off.'); },
  async createServiceRequest() { return okDemo('Request sent. We will reply with a quote.'); },
  async decideQuote(_id, approve) { return okDemo(approve ? 'Quote approved. Work will be billed separately.' : 'Quote declined.'); },
  async saveEmailSettings() { return okDemo('Email settings saved.'); },
  async fulfilOrder(id) { return okDemo(`Order marked fulfilled.`); },
  async refundOrder(i) { return okDemo(`Refund of £${(i.amountMinor / 100).toFixed(2)} requested.`); },
  async inviteMember(email) { return okDemo(`Invitation sent to ${email}.`); },
  async rollbackTheme(v) { return okDemo(`Rollback to v${v} requested.`); },
  async decideGrant(_id, dec) { return okDemo(dec === 'approve' ? 'Access approved for the time shown.' : dec === 'decline' ? 'Request declined.' : 'Access revoked.'); },
  async savePreferences() { return okDemo('Preferences saved.'); },
};
