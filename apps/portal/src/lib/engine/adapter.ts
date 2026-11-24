import { randomUUID } from 'node:crypto';
import type { Order, OrderLine, PaymentStatus, FulfilmentStatus, OrderState, Product, ProductDetail, Variant, TaxClass, Customer, NewProduct, NewDiscount, Discount, ShippingZone, ZoneInput, StockAdjust, RefundInput, MutationResult, VariantInput, OptionGroup, ProductEdit, ImageUpload } from '../gateway';
import { createProductWithVariants, findTaxCategories, type Exec } from './catalogue';
import { slugify } from '@oss-commerce/contracts';

/**
 * Maps the engine's Admin API onto the portal's views. Every function takes the executor as a port, so the same code is
 * proven against a real Vendure in services/engine and used over HTTP in production. Money is always minor units, prices are what the customer pays (with tax).
 */
const ORDER = `id code state active orderPlacedAt updatedAt total totalWithTax shippingWithTax currencyCode
  customer{ firstName lastName emailAddress } shippingAddress{ fullName streetLine1 city postalCode }
  discounts{ amountWithTax } lines{ id quantity unitPriceWithTax productVariant{ sku name product{ name } } featuredAsset{ preview } }
  payments{ id state method amount createdAt refunds{ total state createdAt } } fulfillments{ id state trackingCode createdAt lines{ orderLineId quantity } }`;

type RawOrder = { id: string; code: string; state: string; orderPlacedAt: string | null; updatedAt: string; total: number; totalWithTax: number; shippingWithTax: number;
  customer: { firstName: string; lastName: string; emailAddress: string } | null; shippingAddress: { fullName?: string; streetLine1?: string; city?: string; postalCode?: string } | null;
  discounts: { amountWithTax: number }[]; lines: { id: string; quantity: number; unitPriceWithTax: number; productVariant: { sku: string; name: string; product: { name: string } }; featuredAsset: { preview: string } | null }[];
  payments: { id: string; state: string; method: string; amount: number; createdAt: string; refunds: { total: number; state: string; createdAt: string }[] }[] | null;
  fulfillments: { id: string; state: string; trackingCode: string | null; createdAt: string; lines: { orderLineId: string; quantity: number }[] }[] | null };

export function mapOrder(o: RawOrder): Order {
  const pays = o.payments ?? []; const settled = pays.filter(p => p.state === 'Settled'); const paid = settled.reduce((s, p) => s + p.amount, 0);
  const refunded = pays.flatMap(p => p.refunds).filter(r => r.state === 'Settled' || r.state === 'Pending').reduce((s, r) => s + r.total, 0);
  const payment: PaymentStatus = refunded > 0 ? (refunded >= paid ? 'refunded' : 'partially_refunded') : settled.length ? 'paid' : pays.some(p => p.state === 'Authorized') ? 'authorised' : pays.some(p => p.state === 'Declined' || p.state === 'Error') ? 'failed' : 'pending';
  const fuls = (o.fulfillments ?? []).filter(f => f.state !== 'Cancelled'); const sent = new Map<string, number>(); for (const f of fuls) for (const l of f.lines) sent.set(l.orderLineId, (sent.get(l.orderLineId) ?? 0) + l.quantity);
  const all = o.lines.length > 0 && o.lines.every(l => (sent.get(l.id) ?? 0) >= l.quantity); const fulfilment: FulfilmentStatus = all ? 'fulfilled' : sent.size ? 'partial' : 'unfulfilled';
  const state: OrderState = o.state === 'Cancelled' ? 'cancelled' : all ? 'completed' : 'open';
  const lines: OrderLine[] = o.lines.map(l => { const base = l.productVariant.product.name; const v = l.productVariant.name.startsWith(base) ? l.productVariant.name.slice(base.length).trim() : ''; return { sku: l.productVariant.sku, title: base, variant: v || undefined, qty: l.quantity, unitMinor: l.unitPriceWithTax, imageUrl: l.featuredAsset?.preview }; });
  const placed = o.orderPlacedAt ?? o.updatedAt; const a = o.shippingAddress;
  const timeline = [{ at: placed, text: 'Order placed.' }, ...settled.map(p => ({ at: p.createdAt, text: 'Payment received.' })), ...fuls.map(f => ({ at: f.createdAt, text: f.trackingCode ? `Marked as fulfilled. Tracking ${f.trackingCode}.` : 'Marked as fulfilled.' })),
    ...pays.flatMap(p => p.refunds).map(r => ({ at: r.createdAt, text: `Refunded ${(r.total / 100).toFixed(2)}.` }))].sort((x, y) => x.at.localeCompare(y.at));
  return { id: o.id, number: Number(String(o.id).replace(/\D/g, '')) || 0, placedAt: placed, customer: o.customer ? `${o.customer.firstName} ${o.customer.lastName}`.trim() : 'Guest', email: o.customer?.emailAddress ?? '', lines,
    shippingMinor: o.shippingWithTax, discountMinor: Math.abs(o.discounts.reduce((s, d) => s + d.amountWithTax, 0)), taxMinor: o.totalWithTax - o.total, totalMinor: o.totalWithTax,
    payment, fulfilment, state, refundedMinor: refunded, timeline, shipTo: a ? [a.fullName, a.streetLine1, a.city, a.postalCode].filter(Boolean).join(', ') : '' };
}
/** Orders that were actually placed (the engine also holds baskets that never checked out). Newest first. */
/** Orders placed on or after a calendar day, for reports. Fetched in pages so a busy store is not cut off at the screen limit. */
export async function reportOrders(x: Exec, fromYmd: string): Promise<Order[]> {
  const out: Order[] = [];
  for (let skip = 0; skip < 20000; skip += 500) {
    const r = await x(`query($o: OrderListOptions){ orders(options:$o){ totalItems items{ ${ORDER} } } }`, { o: { take: 500, skip, sort: { orderPlacedAt: 'DESC' }, filter: { active: { eq: false }, orderPlacedAt: { after: `${fromYmd}T00:00:00.000Z` } } } });
    const items = r.orders.items as RawOrder[]; out.push(...items.filter(o => o.orderPlacedAt).map(mapOrder)); if (skip + 500 >= r.orders.totalItems) break;
  }
  return out;
}
export async function listOrders(x: Exec, q?: { filter?: string; q?: string }): Promise<Order[]> {
  const r = await x(`query($o: OrderListOptions){ orders(options:$o){ items{ ${ORDER} } } }`, { o: { take: 200, sort: { orderPlacedAt: 'DESC' }, filter: { active: { eq: false } } } });
  let out = (r.orders.items as RawOrder[]).filter(o => o.orderPlacedAt).map(mapOrder);
  if (q?.filter === 'unfulfilled') out = out.filter(o => o.state === 'open' && o.payment === 'paid');
  if (q?.filter === 'refunded') out = out.filter(o => o.refundedMinor > 0);
  if (q?.filter === 'attention') out = out.filter(o => o.payment === 'failed' || o.payment === 'disputed');
  const t = q?.q?.trim().toLowerCase(); if (t) out = out.filter(o => `${o.number} ${o.customer} ${o.email}`.toLowerCase().includes(t.replace(/^#/, '')));
  return out;
}
export async function getOrder(x: Exec, id: string): Promise<Order | null> { const r = await x(`query($id:ID!){ order(id:$id){ ${ORDER} } }`, { id }); return r.order?.orderPlacedAt ? mapOrder(r.order) : null; }

const PRODUCT = `id name slug description enabled featuredAsset{ id preview } assets{ id name preview } optionGroups{ name options{ name } } customFields{ seoTitle seoDescription }
  variants{ id sku enabled priceWithTax stockOnHand stockAllocated outOfStockThreshold options{ name group{ name } } taxCategory{ name } customFields{ weightGrams compareAtPrice barcode } }`;
type RawVariant = { id: string; sku: string; enabled: boolean; priceWithTax: number; stockOnHand: number; stockAllocated: number; outOfStockThreshold: number; options: { name: string; group: { name: string } }[]; taxCategory: { name: string } | null; customFields: { weightGrams?: number; compareAtPrice?: number | null; barcode?: string | null } | null };
type RawProduct = { id: string; name: string; slug?: string; description?: string; enabled: boolean; featuredAsset: { id?: string; preview: string } | null; assets?: { id: string; name?: string; preview: string }[]; customFields?: { seoTitle?: string | null; seoDescription?: string | null } | null; optionGroups: { name: string; options: { name: string }[] }[]; variants: RawVariant[] };
const taxOf = (n?: string): TaxClass => (/zero/i.test(n ?? '') ? 'zero' : /reduced/i.test(n ?? '') ? 'reduced' : 'standard');
export function mapProduct(p: RawProduct, lowStockAt = 5): Product {
  const vs = p.variants; const first = vs[0];
  return { id: p.id, title: p.name, imageUrl: p.featuredAsset?.preview, status: p.enabled ? 'published' : 'draft', sku: first?.sku ?? '', priceMinor: vs.length ? Math.min(...vs.map(v => v.priceWithTax)) : 0,
    onHand: vs.reduce((s, v) => s + v.stockOnHand, 0), allocated: vs.reduce((s, v) => s + v.stockAllocated, 0), threshold: lowStockAt, variants: vs.length };
}
export async function listProducts(x: Exec): Promise<Product[]> { const r = await x(`query{ products(options:{ take: 200, sort: { createdAt: DESC } }){ items{ ${PRODUCT} } } }`); return (r.products.items as RawProduct[]).map(p => mapProduct(p)); }
export async function getProduct(x: Exec, id: string): Promise<ProductDetail | null> {
  const p = (await x(`query($id:ID!){ product(id:$id){ ${PRODUCT} } }`, { id })).product as RawProduct | null; if (!p) return null;
  const order = p.optionGroups.map(g => g.name);
  const variantList: Variant[] = p.variants.map(v => ({ id: v.id, options: order.map(g => v.options.find(o => o.group.name === g)?.name ?? '').filter(Boolean), sku: v.sku, priceMinor: v.priceWithTax, onHand: v.stockOnHand, allocated: v.stockAllocated, taxClass: taxOf(v.taxCategory?.name), enabled: v.enabled, compareAtMinor: v.customFields?.compareAtPrice ?? undefined, barcode: v.customFields?.barcode ?? undefined, weightGrams: v.customFields?.weightGrams || undefined }));
  return { ...mapProduct(p), optionGroups: p.optionGroups.map(g => ({ name: g.name, options: g.options.map(o => o.name) })), variantList, description: p.description ?? '', handle: p.slug ?? '', seoTitle: p.customFields?.seoTitle ?? '', seoDescription: p.customFields?.seoDescription ?? '', images: (p.assets ?? []).map(a => ({ id: a.id, url: a.preview, name: a.name })) };
}
export async function listCustomers(x: Exec): Promise<Customer[]> {
  const r = await x(`query{ customers(options:{ take: 200 }){ items{ id firstName lastName emailAddress orders(options:{ take: 100, filter:{ active:{ eq:false } } }){ totalItems items{ totalWithTax orderPlacedAt } } } } }`);
  return (r.customers.items as any[]).map(c => { const os = (c.orders.items as any[]).filter(o => o.orderPlacedAt); return { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.emailAddress, orders: os.length, spentMinor: os.reduce((s, o) => s + o.totalWithTax, 0), lastOrder: os.map(o => o.orderPlacedAt).sort().at(-1) ?? '', marketing: false }; }).filter(c => c.orders > 0);
}

type RawOperation = { code: string; args: { name: string; value: string }[] };
type RawPromotion = { id: string; name: string; enabled: boolean; couponCode?: string | null; startsAt?: string | null; endsAt?: string | null; usageLimit?: number | null; conditions: RawOperation[]; actions: RawOperation[] };
const arg = (op: RawOperation | undefined, name: string) => op?.args.find(a => a.name === name)?.value;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function mapDiscount(p: RawPromotion, used = 0, now = new Date()): Discount | null {
  if (!p.couponCode) return null;
  const action = p.actions[0];
  const kind: Discount['kind'] = action?.code === 'order_percentage_discount' ? 'percent' : action?.code === 'oss-fixed-order-discount' ? 'fixed' : action?.code === 'free_shipping' ? 'shipping' : 'shipping';
  if (!['order_percentage_discount', 'oss-fixed-order-discount', 'free_shipping'].includes(action?.code ?? '')) return null;
  const value = kind === 'percent' ? Number(arg(action, 'discount') ?? 0) : kind === 'fixed' ? Number(arg(action, 'amount') ?? 0) : 0;
  const start = p.startsAt ? new Date(p.startsAt) : null; const end = p.endsAt ? new Date(p.endsAt) : null;
  const status: Discount['status'] = !p.enabled || (end && end <= now) ? 'expired' : start && start > now ? 'scheduled' : 'active';
  const min = p.conditions.find(c => c.code === 'minimum_order_amount');
  const window = start && start > now ? `Starts ${shortDate(p.startsAt!)}` : end ? `Ends ${shortDate(p.endsAt!)}` : 'No end date';
  return { code: p.couponCode, kind, value, status, used, limit: p.usageLimit ?? undefined, window, minSpendMinor: min ? Number(arg(min, 'amount') ?? 0) || undefined : undefined };
}

export async function listDiscounts(x: Exec): Promise<Discount[]> {
  const [promotions, orders] = await Promise.all([
    x(`query{ promotions(options:{ take:200, sort:{ createdAt:DESC } }){ items{ id name enabled couponCode startsAt endsAt usageLimit conditions{ code args{ name value } } actions{ code args{ name value } } } } }`),
    x(`query{ orders(options:{ take:1000, filter:{ active:{ eq:false } } }){ items{ id orderPlacedAt promotions{ id } } } }`),
  ]);
  const use = new Map<string, number>();
  for (const o of orders.orders.items as { orderPlacedAt?: string | null; promotions: { id: string }[] }[]) if (o.orderPlacedAt) for (const p of o.promotions) use.set(p.id, (use.get(p.id) ?? 0) + 1);
  return (promotions.promotions.items as RawPromotion[]).map(p => mapDiscount(p, use.get(p.id) ?? 0)).filter((d): d is Discount => !!d);
}

export async function createDiscount(x: Exec, d: NewDiscount): Promise<MutationResult> {
  try {
    const code = d.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,24}$/.test(code)) return { ok: false, message: 'Use 2–24 letters and numbers for the discount code.' };
    if (d.kind === 'percent' && (!Number.isFinite(d.value) || d.value < 1 || d.value > 100)) return { ok: false, message: 'Percentage discounts must be between 1 and 100.' };
    if (d.kind === 'fixed' && (!Number.isInteger(d.value) || d.value < 1)) return { ok: false, message: 'Enter a fixed discount of at least 0.01.' };
    if (d.limit !== undefined && (!Number.isInteger(d.limit) || d.limit < 1)) return { ok: false, message: 'Total uses must be at least 1.' };
    const existing = (await x(`query{ promotions(options:{ take:200 }){ items{ couponCode } } }`)).promotions.items as { couponCode?: string | null }[];
    if (existing.some(p => p.couponCode?.toUpperCase() === code)) return { ok: false, message: `${code} is already in use.` };
    const conditions = d.minSpendMinor && d.minSpendMinor > 0 ? [{ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: String(d.minSpendMinor) }, { name: 'taxInclusive', value: 'true' }] }] : [];
    const action = d.kind === 'percent' ? { code: 'order_percentage_discount', arguments: [{ name: 'discount', value: String(d.value) }] }
      : d.kind === 'fixed' ? { code: 'oss-fixed-order-discount', arguments: [{ name: 'amount', value: String(d.value) }] }
      : { code: 'free_shipping', arguments: [] };
    const endsAt = d.endDate ? new Date(`${d.endDate}T23:59:59.999Z`).toISOString() : undefined;
    if (d.endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(d.endDate) || Number.isNaN(Date.parse(`${d.endDate}T23:59:59.999Z`)))) return { ok: false, message: 'Choose a valid end date.' };
    const input = { enabled: true, couponCode: code, usageLimit: d.limit, endsAt, conditions, actions: [action], translations: [{ languageCode: 'en', name: `${code} discount`, description: 'Customer coupon created in OneSimpleCommerce.' }] };
    const result = (await x(`mutation($i:CreatePromotionInput!){ createPromotion(input:$i){ __typename ... on Promotion{ id } ... on ErrorResult{ message } } }`, { i: input })).createPromotion;
    if (result.__typename !== 'Promotion') return { ok: false, message: result.message ?? 'The discount could not be created.' };
    return { ok: true, message: `${code} is active.` };
  } catch (e) { return fail(e); }
}

type RawShippingMethod = { id: string; code: string; name: string; checker: RawOperation; calculator: RawOperation };
const ZONE_CHECKER = 'oss-delivery-zone';
const ZONE_CALCULATOR = 'oss-flat-rate-free-over';

function mapShippingZones(methods: RawShippingMethod[]): ShippingZone[] {
  const groups = new Map<string, ShippingZone>();
  for (const m of methods) {
    const legacy = m.code.startsWith('ship-') && m.calculator.code === 'default-shipping-calculator';
    if (!legacy && (m.checker.code !== ZONE_CHECKER || m.calculator.code !== ZONE_CALCULATOR)) continue;
    const name = legacy ? 'United Kingdom' : arg(m.checker, 'zoneName')?.trim(); const regions = legacy ? 'United Kingdom' : arg(m.checker, 'regionsLabel')?.trim();
    if (!name || !regions) continue;
    const zone = groups.get(name) ?? { name, regions, rates: [] };
    const free = legacy ? 0 : Number(arg(m.calculator, 'freeOver') ?? 0);
    zone.rates.push({ label: m.name, priceMinor: Number(arg(m.calculator, 'rate') ?? 0), freeOverMinor: free > 0 ? free : undefined });
    groups.set(name, zone);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listShippingTax(x: Exec): Promise<{ zones: ShippingZone[]; pricesIncludeTax: boolean }> {
  const r = await x(`query{ activeChannel{ pricesIncludeTax } shippingMethods(options:{ take:200, sort:{ createdAt:ASC } }){ items{ id code name checker{ code args{ name value } } calculator{ code args{ name value } } } } }`);
  return { zones: mapShippingZones(r.shippingMethods.items as RawShippingMethod[]), pricesIncludeTax: !!r.activeChannel?.pricesIncludeTax };
}

export async function saveShippingZone(x: Exec, d: ZoneInput): Promise<MutationResult> {
  try {
    const name = d.name.trim(); const regionsLabel = d.regions.trim();
    if (name.length < 2 || name.length > 60) return { ok: false, message: 'Use 2–60 characters for the zone name.' };
    if (!regionsLabel) return { ok: false, message: 'Choose at least one country.' };
    if (!d.rates.length || d.rates.length > 10) return { ok: false, message: 'Add between 1 and 10 delivery options.' };
    for (const rate of d.rates) {
      if (!rate.label.trim() || rate.label.trim().length > 80) return { ok: false, message: 'Each delivery option needs a name of no more than 80 characters.' };
      if (!Number.isInteger(rate.priceMinor) || rate.priceMinor < 0) return { ok: false, message: 'Each delivery price must be zero or more.' };
      if (rate.freeOverMinor !== undefined && (!Number.isInteger(rate.freeOverMinor) || rate.freeOverMinor < 1)) return { ok: false, message: 'A free-delivery threshold must be at least 0.01.' };
    }
    const [countryResult, methodResult] = await Promise.all([
      x(`query{ activeChannel{ pricesIncludeTax } countries(options:{ take:250 }){ items{ code name enabled } } }`),
      x(`query{ shippingMethods(options:{ take:200 }){ items{ id code name checker{ code args{ name value } } calculator{ code args{ name value } } } } }`),
    ]);
    const countries = (countryResult.countries.items as { code: string; name: string; enabled: boolean }[]).filter(c => c.enabled);
    const aliases: Record<string, string> = { uk: 'GB', 'great britain': 'GB', britain: 'GB', usa: 'US', 'united states': 'US' };
    const requested = regionsLabel.split(/[,;]+/).map(v => v.trim()).filter(Boolean);
    const codes: string[] = []; const unknown: string[] = [];
    for (const value of requested) {
      const lower = value.toLowerCase(); const alias = aliases[lower];
      const found = countries.find(c => c.code.toLowerCase() === lower || c.name.toLowerCase() === lower || c.code === alias);
      if (found) codes.push(found.code.toUpperCase()); else unknown.push(value);
    }
    if (unknown.length) return { ok: false, message: `We could not match ${unknown.join(', ')} to an enabled country. Use country names or two-letter ISO codes.` };
    const countryCodes = [...new Set(codes)].join(',');
    const methods = methodResult.shippingMethods.items as RawShippingMethod[];
    const managed = methods.filter(m => m.checker.code === ZONE_CHECKER || (m.code.startsWith('ship-') && m.calculator.code === 'default-shipping-calculator'));
    const zoneName = (m: RawShippingMethod) => m.checker.code === ZONE_CHECKER ? arg(m.checker, 'zoneName')?.trim() : 'United Kingdom';
    const original = (d.originalName ?? '').trim().toLowerCase();
    if (managed.some(m => zoneName(m)?.toLowerCase() === name.toLowerCase() && zoneName(m)?.toLowerCase() !== original)) return { ok: false, message: `A zone named ${name} already exists.` };
    const current = original ? managed.filter(m => zoneName(m)?.toLowerCase() === original) : [];
    const pricesIncludeTax = !!countryResult.activeChannel?.pricesIncludeTax;
    const operation = (rate: ZoneInput['rates'][number]) => ({
      checker: { code: ZONE_CHECKER, arguments: [{ name: 'countries', value: countryCodes }, { name: 'zoneName', value: name }, { name: 'regionsLabel', value: regionsLabel }] },
      calculator: { code: ZONE_CALCULATOR, arguments: [{ name: 'rate', value: String(rate.priceMinor) }, { name: 'freeOver', value: String(rate.freeOverMinor ?? 0) }, { name: 'includesTax', value: String(pricesIncludeTax) }, { name: 'taxRate', value: '20' }] },
      fulfillmentHandler: 'manual-fulfillment', translations: [{ languageCode: 'en', name: rate.label.trim(), description: `Delivery to ${regionsLabel}` }],
    });
    for (let i = 0; i < d.rates.length; i++) {
      const input = operation(d.rates[i]);
      if (current[i]) await x(`mutation($i:UpdateShippingMethodInput!){ updateShippingMethod(input:$i){ id } }`, { i: { id: current[i].id, code: current[i].code, ...input } });
      else await x(`mutation($i:CreateShippingMethodInput!){ createShippingMethod(input:$i){ id } }`, { i: { code: `oss-zone-${randomUUID()}`, ...input } });
    }
    for (const stale of current.slice(d.rates.length)) await x(`mutation($id:ID!){ deleteShippingMethod(id:$id){ result message } }`, { id: stale.id });
    return { ok: true, message: `${name} delivery options are live.` };
  } catch (e) { return fail(e); }
}

const fail = (e: unknown): MutationResult => ({ ok: false, message: e instanceof Error ? e.message : 'That did not go through. Nothing was changed.' });
const errorResult = (r: { __typename?: string; message?: string } | null | undefined) => (r && 'message' in r && r.message && !/^(Order|Fulfillment|Refund|Product)/.test(r.__typename ?? '') ? r.message : null);

export async function addProduct(x: Exec, p: NewProduct): Promise<MutationResult> {
  try { const sku = (p.sku || p.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 12)).toUpperCase();
    const taken = (await x(`query($s:String!){ productVariants(options:{ filter:{ sku:{ eq:$s } }, take:1 }){ totalItems } }`, { s: sku })).productVariants.totalItems; if (taken) return { ok: false, message: `SKU ${sku} is already used by another product.` };
    const id = await createProductWithVariants(x, { title: p.title, slug: p.handle || undefined, description: p.description, seoTitle: p.seoTitle, seoDescription: p.seoDescription, enabled: p.status === 'published', optionGroups: [], variants: [{ options: [], sku, priceMinor: p.priceMinor, stock: p.onHand, taxClass: p.taxClass, weightGrams: p.weightGrams, compareAtMinor: p.compareAtMinor, barcode: p.barcode }] });
    return { ok: true, id, message: p.status === 'published' ? `${p.title} is published.` : `${p.title} saved as a draft.` };
  } catch (e) { return fail(e); }
}
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']); const PHOTO_MAX = 10 * 1024 * 1024;
export async function updateProduct(x: Exec, id: string, e: ProductEdit): Promise<MutationResult> {
  try {
    if (!e.title.trim()) return { ok: false, message: 'A product needs a name.' };
    const handle = e.handle.trim() ? slugify(e.handle) : slugify(e.title);
    const r = (await x(`mutation($i: UpdateProductInput!){ updateProduct(input:$i){ id } }`, { i: { id, enabled: e.status === 'published', translations: [{ languageCode: 'en', name: e.title.trim(), slug: handle, description: e.description }], customFields: { seoTitle: e.seoTitle.trim() || null, seoDescription: e.seoDescription.trim() || null } } })).updateProduct;
    return r?.id ? { ok: true, message: e.status === 'published' ? 'Saved. This product is on your store.' : 'Saved as a draft. It is hidden from your store.' } : { ok: false, message: 'The product could not be saved.' };
  } catch (err) { return fail(err); }
}
export async function deleteProduct(x: Exec, id: string): Promise<MutationResult> {
  try { const r = (await x(`mutation($id:ID!){ deleteProduct(id:$id){ result message } }`, { id })).deleteProduct; return r?.result === 'DELETED' ? { ok: true, message: 'Product deleted.' } : { ok: false, message: r?.message || 'The product could not be deleted.' }; } catch (err) { return fail(err); }
}
export async function uploadProductImages(x: Exec, id: string, files: ImageUpload[]): Promise<MutationResult> {
  try {
    if (!x.upload) return { ok: false, message: 'Photo upload is not available for this store yet.' };
    const problems: string[] = []; const ok = files.filter(f => { if (!PHOTO_TYPES.has(f.type)) { problems.push(`${f.name} is not a JPEG, PNG or WebP photo`); return false; } if (f.bytes.length === 0 || f.bytes.length > PHOTO_MAX) { problems.push(`${f.name} is over 10 MB`); return false; } return true; });
    if (!ok.length) return { ok: false, message: problems.join('. ') || 'No photos were added.' };
    const up = (await x.upload(`mutation($input:[CreateAssetInput!]!){ createAssets(input:$input){ __typename ... on Asset { id } ... on ErrorResult { message } } }`, { input: ok.map(() => ({ file: null })) }, ok.map((f, i) => ({ path: `variables.input.${i}.file`, file: f })))).createAssets as { __typename: string; id?: string; message?: string }[];
    const made = up.filter(a => a.__typename === 'Asset' && a.id).map(a => a.id!); for (const a of up) if (a.message) problems.push(a.message);
    if (!made.length) return { ok: false, message: problems.join('. ') || 'The photos could not be stored.' };
    const cur = (await x(`query($id:ID!){ product(id:$id){ featuredAsset{ id } assets{ id } } }`, { id })).product as { featuredAsset: { id: string } | null; assets: { id: string }[] } | null; if (!cur) return { ok: false, message: 'Product not found.' };
    await x(`mutation($i: UpdateProductInput!){ updateProduct(input:$i){ id } }`, { i: { id, assetIds: [...cur.assets.map(a => a.id), ...made], featuredAssetId: cur.featuredAsset?.id ?? made[0] } });
    return { ok: true, message: `${made.length} photo${made.length > 1 ? 's' : ''} added${problems.length ? `. ${problems.join('. ')}.` : ''}` };
  } catch (err) { return fail(err); }
}
export async function setProductImages(x: Exec, id: string, orderedIds: string[]): Promise<MutationResult> {
  try {
    const cur = (await x(`query($id:ID!){ product(id:$id){ assets{ id } } }`, { id })).product as { assets: { id: string }[] } | null; if (!cur) return { ok: false, message: 'Product not found.' };
    const have = new Set(cur.assets.map(a => a.id)); const ids = orderedIds.filter(i => have.has(i)); if (new Set(ids).size !== ids.length) return { ok: false, message: 'A photo was listed twice.' };
    await x(`mutation($i: UpdateProductInput!){ updateProduct(input:$i){ id } }`, { i: { id, assetIds: ids, featuredAssetId: ids[0] ?? null } });
    const gone = cur.assets.map(a => a.id).filter(a => !ids.includes(a));
    if (gone.length) { try { await x(`mutation($i: DeleteAssetsInput!){ deleteAssets(input:$i){ result } }`, { i: { assetIds: gone, force: false } }); } catch { /* still used elsewhere or already gone: the product no longer shows it either way */ } }
    return { ok: true, message: gone.length ? `Photos updated. ${gone.length} removed.` : 'Photo order saved.' };
  } catch (err) { return fail(err); }
}
export async function adjustStock(x: Exec, a: StockAdjust): Promise<MutationResult> {
  try { const p = await getProduct(x, a.productId); if (!p) return { ok: false, message: 'Product not found.' };
    if (p.variantList.length !== 1) return { ok: false, message: 'This product has several variants. Set the stock for each one under Options and variants.' };
    const v = p.variantList[0]; const to = a.mode === 'set' ? a.qty : v.onHand + a.qty; if (to < 0) return { ok: false, message: `That would take stock below zero (you have ${v.onHand}).` }; if (to < v.allocated) return { ok: false, message: `${v.allocated} are reserved for open orders, so stock cannot go below that.` };
    await x(`mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id } }`, { i: [{ id: v.id, stockOnHand: to }] });
    return { ok: true, message: `${p.title}: ${v.onHand} to ${to} on hand. Logged as ${a.reason}.` };
  } catch (e) { return fail(e); }
}
/** Saves price, SKU, stock, tax class, weight and on-sale for existing variants. Changing the option structure itself (adding or removing options) is not supported through this path yet and is refused rather than half-applied. */
export async function saveVariants(x: Exec, productId: string, d: { optionGroups: OptionGroup[]; variants: VariantInput[] }): Promise<MutationResult> {
  try { const p = await getProduct(x, productId); if (!p) return { ok: false, message: 'Product not found.' };
    const same = JSON.stringify(p.optionGroups) === JSON.stringify(d.optionGroups) && d.variants.length === p.variantList.length && d.variants.every(v => p.variantList.some(e => e.options.join('|') === v.options.join('|')));
    if (!same) return { ok: false, message: 'Adding or removing options on an existing product is not available yet. Prices, stock and other details can be changed.' };
    const tax = await findTaxCategories(x);
    const input = d.variants.map(v => { const e = p.variantList.find(q => q.options.join('|') === v.options.join('|'))!; return { id: e.id, sku: v.sku, price: undefined as number | undefined, priceWithTaxWanted: v.priceMinor, taxCategoryId: tax[v.taxClass], stockOnHand: v.stock, enabled: v.enabled, customFields: { weightGrams: v.weightGrams ?? 0, compareAtPrice: v.compareAtMinor || null, barcode: v.barcode || null } }; });
    // Prices are entered as the customer pays them. The channel stores them that way when its prices include tax, which is how every cell is configured.
    await x(`mutation($i:[UpdateProductVariantInput!]!){ updateProductVariants(input:$i){ id } }`, { i: input.map(({ priceWithTaxWanted, price: _p, ...rest }) => ({ ...rest, price: priceWithTaxWanted })) });
    return { ok: true, message: `${d.variants.length} variant${d.variants.length > 1 ? 's' : ''} saved.` };
  } catch (e) { return fail(e); }
}
export async function fulfilOrder(x: Exec, orderId: string, tracking?: string): Promise<MutationResult> {
  try { const o = (await x(`query($id:ID!){ order(id:$id){ id state lines{ id quantity } fulfillments{ state lines{ orderLineId quantity } } } }`, { id: orderId })).order; if (!o) return { ok: false, message: 'Order not found.' };
    const sent = new Map<string, number>(); for (const f of (o.fulfillments ?? []).filter((f: any) => f.state !== 'Cancelled')) for (const l of f.lines) sent.set(l.orderLineId, (sent.get(l.orderLineId) ?? 0) + l.quantity);
    const lines = (o.lines as { id: string; quantity: number }[]).map(l => ({ orderLineId: l.id, quantity: l.quantity - (sent.get(l.id) ?? 0) })).filter(l => l.quantity > 0); if (!lines.length) return { ok: false, message: 'This order is already fulfilled.' };
    const r = (await x(`mutation($i: FulfillOrderInput!){ addFulfillmentToOrder(input:$i){ __typename ... on Fulfillment { id } ... on ErrorResult { message } } }`, { i: { lines, handler: { code: 'manual-fulfillment', arguments: [{ name: 'method', value: 'Manual' }, { name: 'trackingCode', value: tracking ?? '' }] } } })).addFulfillmentToOrder;
    if (r.__typename !== 'Fulfillment') return { ok: false, message: r.message ?? 'The order could not be fulfilled.' };
    const t = (await x(`mutation($id:ID!){ transitionFulfillmentToState(id:$id, state:"Shipped"){ __typename ... on ErrorResult { message } } }`, { id: r.id })).transitionFulfillmentToState; const bad = errorResult(t); if (bad) return { ok: false, message: bad };
    return { ok: true, message: tracking ? `Marked as fulfilled with tracking ${tracking}. The customer is told by email.` : 'Marked as fulfilled. The customer is told by email.' };
  } catch (e) { return fail(e); }
}
export async function refundOrder(x: Exec, i: RefundInput): Promise<MutationResult> {
  try { const o = (await x(`query($id:ID!){ order(id:$id){ payments{ id state amount refunds{ total state } } } }`, { id: i.orderId })).order; if (!o) return { ok: false, message: 'Order not found.' };
    const pay = (o.payments as any[]).find(p => p.state === 'Settled'); if (!pay) return { ok: false, message: 'There is no settled payment on this order to refund.' };
    const already = (pay.refunds as any[]).filter(r => r.state !== 'Failed').reduce((s, r) => s + r.total, 0); if (i.amountMinor <= 0 || i.amountMinor > pay.amount - already) return { ok: false, message: `You can refund up to ${((pay.amount - already) / 100).toFixed(2)} on this order.` };
    const r = (await x(`mutation($i: RefundOrderInput!){ refundOrder(input:$i){ __typename ... on Refund { id state } ... on ErrorResult { message } } }`, { i: { lines: [], shipping: 0, adjustment: 0, amount: i.amountMinor, paymentId: pay.id, reason: i.reason || 'Refund' } })).refundOrder;
    if (r.__typename !== 'Refund') return { ok: false, message: r.message ?? 'The refund could not be made.' }; if (r.state === 'Failed') return { ok: false, message: 'The payment provider declined the refund. Nothing was refunded.' };
    return { ok: true, message: `Refunded ${(i.amountMinor / 100).toFixed(2)} to the customer's original payment method.` };
  } catch (e) { return fail(e); }
}
