import { randomUUID } from 'node:crypto';
import type { Order, OrderLine, PaymentStatus, FulfilmentStatus, OrderState, Product, ProductDetail, Variant, TaxClass, Customer, NewProduct, NewDiscount, Discount, ShippingZone, ZoneInput, StockAdjust, RefundInput, MutationResult, VariantInput, OptionGroup, ProductEdit, ImageUpload, DiscountInput, DiscountProduct, Collection, CollectionInput, CustomerDetail, CustomerProfile, OrderableItem, ManualOrderInput, ShippingChoice } from '../gateway';
import { createProductWithVariants, findTaxCategories, previewCollection, type Exec } from './catalogue';
import { slugify } from '@oss-commerce/contracts';
import { statusOf, validateDiscount } from '../discounts';

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
  fulfillments: { id: string; state: string; trackingCode: string | null; createdAt: string; lines: { orderLineId: string; quantity: number }[] }[] | null;
  history?: { items: { type: string; createdAt: string; data: Record<string, unknown>; administrator: { firstName: string; lastName: string } | null }[] } };

export function mapOrder(o: RawOrder): Order {
  const pays = o.payments ?? []; const settled = pays.filter(p => p.state === 'Settled'); const paid = settled.reduce((s, p) => s + p.amount, 0);
  const refunded = pays.flatMap(p => p.refunds).filter(r => r.state === 'Settled' || r.state === 'Pending').reduce((s, r) => s + r.total, 0);
  const payment: PaymentStatus = refunded > 0 ? (refunded >= paid ? 'refunded' : 'partially_refunded') : settled.length ? 'paid' : pays.some(p => p.state === 'Authorized') ? 'authorised' : pays.some(p => p.state === 'Declined' || p.state === 'Error') ? 'failed' : 'pending';
  const fuls = (o.fulfillments ?? []).filter(f => f.state !== 'Cancelled'); const sent = new Map<string, number>(); for (const f of fuls) for (const l of f.lines) sent.set(l.orderLineId, (sent.get(l.orderLineId) ?? 0) + l.quantity);
  const all = o.lines.length > 0 && o.lines.every(l => (sent.get(l.id) ?? 0) >= l.quantity); const fulfilment: FulfilmentStatus = all ? 'fulfilled' : sent.size ? 'partial' : 'unfulfilled';
  const state: OrderState = o.state === 'Cancelled' ? 'cancelled' : all ? 'completed' : 'open';
  const lines: OrderLine[] = o.lines.map(l => { const base = l.productVariant.product.name; const v = l.productVariant.name.startsWith(base) ? l.productVariant.name.slice(base.length).trim() : ''; return { id: l.id, sent: sent.get(l.id) ?? 0, sku: l.productVariant.sku, title: base, variant: v || undefined, qty: l.quantity, unitMinor: l.unitPriceWithTax, imageUrl: l.featuredAsset?.preview }; });
  const placed = o.orderPlacedAt ?? o.updatedAt; const a = o.shippingAddress;
  const timeline = [{ at: placed, text: 'Order placed.' }, ...settled.map(p => ({ at: p.createdAt, text: 'Payment received.' })), ...fuls.map(f => ({ at: f.createdAt, text: f.trackingCode ? `Marked as fulfilled. Tracking ${f.trackingCode}.` : 'Marked as fulfilled.' })),
    ...pays.flatMap(p => p.refunds).map(r => ({ at: r.createdAt, text: `Refunded ${(r.total / 100).toFixed(2)}.` })),
  ...(o.history?.items ?? []).flatMap((h): { at: string; text: string; note?: boolean; by?: string }[] => h.type === 'ORDER_NOTE' && typeof h.data.note === 'string' ? [{ at: h.createdAt, text: h.data.note, note: true, by: h.administrator ? `${h.administrator.firstName} ${h.administrator.lastName}`.trim() : undefined }] : h.type === 'ORDER_CANCELLATION' ? [{ at: h.createdAt, text: `Order cancelled${typeof h.data.reason === 'string' && h.data.reason ? `: ${h.data.reason}` : ''}.` }] : [])].sort((x, y) => x.at.localeCompare(y.at));
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
const ORDER_DETAIL = `${ORDER} history(options:{ take: 100, sort:{ createdAt: ASC } }){ items{ type createdAt data administrator{ firstName lastName } } }`;
export async function getOrder(x: Exec, id: string): Promise<Order | null> { const r = await x(`query($id:ID!){ order(id:$id){ ${ORDER_DETAIL} } }`, { id }); return r.order?.orderPlacedAt ? mapOrder(r.order) : null; }

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
type RawPromotion = { id: string; name: string; enabled: boolean; couponCode?: string | null; startsAt?: string | null; endsAt?: string | null; usageLimit?: number | null; perCustomerUsageLimit?: number | null; conditions: RawOperation[]; actions: RawOperation[] };
const arg = (op: RawOperation | undefined, name: string) => op?.args.find(a => a.name === name)?.value;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const ids = (v: string | undefined): string[] => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } };
/** Reads any promotion into the portal's shape. `productOf` maps a variant id back to its product id so scopes can be shown by product. */
export function mapDiscount(p: RawPromotion, used = 0, now = new Date(), productOf: (variantId: string) => string | undefined = () => undefined): Discount {
  const action = p.actions[0]; const cond = (c: string) => p.conditions.find(x => x.code === c);
  let kind: Discount['kind'] = 'custom'; let value = 0; let productIds: string[] | undefined; let buy: number | undefined; let get: number | undefined;
  switch (action?.code) {
    case 'order_percentage_discount': kind = 'percent'; value = Number(arg(action, 'discount') ?? 0); break;
    case 'products_percentage_discount': kind = 'percent'; value = Number(arg(action, 'discount') ?? 0); productIds = [...new Set(ids(arg(action, 'productVariantIds')).map(v => productOf(v)).filter((x): x is string => !!x))]; break;
    case 'oss-fixed-order-discount': kind = 'fixed'; value = Number(arg(action, 'amount') ?? 0); break;
    case 'order_fixed_discount': kind = 'fixed'; value = Number(arg(action, 'discount') ?? 0); break;
    case 'free_shipping': kind = 'shipping'; break;
    case 'oss-buy-x-get-y': kind = 'bogo'; buy = Number(arg(action, 'buy') ?? 0); get = Number(arg(action, 'get') ?? 0); productIds = [...new Set(ids(arg(action, 'productVariantIds')).map(v => productOf(v)).filter((x): x is string => !!x))]; break;
    case 'buy_x_get_y_free': { /* the engine asks for buy + get in the basket, with `get` of them free */ const c = cond('buy_x_get_y_free'); kind = 'bogo'; get = Number(arg(c, 'amountY') ?? 0); buy = Math.max(Number(arg(c, 'amountX') ?? 0) - get, 0); productIds = [...new Set(ids(arg(c, 'variantIdsX')).map(v => productOf(v)).filter((x): x is string => !!x))]; break; }
  }
  const start = p.startsAt ? new Date(p.startsAt) : null; const end = p.endsAt ? new Date(p.endsAt) : null;
  const window = start && start > now ? `Starts ${shortDate(p.startsAt!)}${end ? `, ends ${shortDate(p.endsAt!)}` : ''}` : end ? (end <= now ? `Ended ${shortDate(p.endsAt!)}` : `Ends ${shortDate(p.endsAt!)}`) : 'No end date';
  const min = cond('minimum_order_amount');
  return { id: p.id, name: p.name, code: p.couponCode ?? '', automatic: !p.couponCode, kind, value, status: statusOf(p, now), used, limit: p.usageLimit ?? undefined, perCustomer: p.perCustomerUsageLimit ?? undefined, window, minSpendMinor: min ? Number(arg(min, 'amount') ?? 0) || undefined : undefined,
    productIds, buy, get, startsAt: p.startsAt ?? undefined, endsAt: p.endsAt ?? undefined };
}

const PROMO = `id name enabled couponCode startsAt endsAt usageLimit perCustomerUsageLimit conditions{ code args{ name value } } actions{ code args{ name value } }`;
export async function listDiscounts(x: Exec): Promise<Discount[]> {
  const [promotions, orders, products] = await Promise.all([
    x(`query{ promotions(options:{ take:200, sort:{ createdAt:DESC } }){ items{ ${PROMO} } } }`),
    x(`query{ orders(options:{ take:1000, filter:{ active:{ eq:false } } }){ items{ id orderPlacedAt promotions{ id } } } }`),
    x(`query{ products(options:{ take:500 }){ items{ id variants{ id } } } }`),
  ]);
  const use = new Map<string, number>();
  for (const o of orders.orders.items as { orderPlacedAt?: string | null; promotions: { id: string }[] }[]) if (o.orderPlacedAt) for (const p of o.promotions) use.set(p.id, (use.get(p.id) ?? 0) + 1);
  const owner = new Map<string, string>(); for (const p of products.products.items as { id: string; variants: { id: string }[] }[]) for (const v of p.variants) owner.set(v.id, p.id);
  return (promotions.promotions.items as RawPromotion[]).map(p => mapDiscount(p, use.get(p.id) ?? 0, new Date(), v => owner.get(v)));
}
export async function listDiscountProducts(x: Exec): Promise<DiscountProduct[]> {
  return ((await x(`query{ products(options:{ take:500, sort:{ name:ASC } }){ items{ id name variants{ id } } } }`)).products.items as { id: string; name: string; variants: { id: string }[] }[]).map(p => ({ id: p.id, title: p.name, variantIds: p.variants.map(v => v.id) }));
}
/** Builds the engine's conditions and action for a form. Product scopes are checked against this store's own catalogue first. */
async function promotionParts(x: Exec, d: DiscountInput): Promise<{ conditions: unknown[]; actions: unknown[] } | string> {
  const conditions: { code: string; arguments: { name: string; value: string }[] }[] = []; let variantIds: string[] = [];
  if (d.productIds?.length) { const own = await listDiscountProducts(x); const picked = own.filter(p => d.productIds!.includes(p.id)); if (picked.length !== new Set(d.productIds).size) return 'One of the chosen products is not in your catalogue.'; variantIds = picked.flatMap(p => p.variantIds); }
  if (d.minSpendMinor && d.minSpendMinor > 0) conditions.push({ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: String(d.minSpendMinor) }, { name: 'taxInclusive', value: 'true' }] });
  let action: { code: string; arguments: { name: string; value: string }[] };
  if (d.kind === 'percent') action = variantIds.length ? { code: 'products_percentage_discount', arguments: [{ name: 'discount', value: String(d.value) }, { name: 'productVariantIds', value: JSON.stringify(variantIds) }] } : { code: 'order_percentage_discount', arguments: [{ name: 'discount', value: String(d.value) }] };
  else if (d.kind === 'fixed') action = { code: 'oss-fixed-order-discount', arguments: [{ name: 'amount', value: String(d.value) }] };
  else if (d.kind === 'shipping') action = { code: 'free_shipping', arguments: [] };
  else action = { code: 'oss-buy-x-get-y', arguments: [{ name: 'buy', value: String(d.buy) }, { name: 'get', value: String(d.get) }, { name: 'productVariantIds', value: JSON.stringify(variantIds) }] };
  // The engine needs a code or at least one condition. An automatic offer with no other rule gets an always-true one: an order of at least £0.
  if (d.method === 'automatic' && !conditions.length) conditions.push({ code: 'minimum_order_amount', arguments: [{ name: 'amount', value: '0' }, { name: 'taxInclusive', value: 'true' }] });
  return { conditions, actions: [action] };
}
const todayYmd = () => new Date().toISOString().slice(0, 10);
export async function saveDiscount(x: Exec, d: DiscountInput): Promise<MutationResult> {
  try {
    const problem = validateDiscount(d, todayYmd()); if (problem) return { ok: false, message: problem };
    const code = d.method === 'code' ? (d.code ?? '').trim().toUpperCase() : null;
    const all = (await x(`query{ promotions(options:{ take:200 }){ items{ id couponCode } } }`)).promotions.items as { id: string; couponCode?: string | null }[];
    if (code && all.some(p => p.id !== d.id && p.couponCode?.toUpperCase() === code)) return { ok: false, message: `${code} is already in use.` };
    const parts = await promotionParts(x, d); if (typeof parts === 'string') return { ok: false, message: parts };
    const startsAt = d.startDate ? new Date(`${d.startDate}T00:00:00.000Z`).toISOString() : null; const endsAt = d.endDate ? new Date(`${d.endDate}T23:59:59.999Z`).toISOString() : null;
    const name = (d.name?.trim() || (code ? `${code} discount` : 'Automatic discount')).slice(0, 120);
    const input = { ...(d.id ? { id: d.id } : {}), enabled: d.enabled, couponCode: code, startsAt, endsAt, usageLimit: d.limit ?? null, perCustomerUsageLimit: d.perCustomer ?? null, ...parts, translations: [{ languageCode: 'en', name, description: 'Created in OneSimpleCommerce.' }] };
    const r = d.id ? (await x(`mutation($i:UpdatePromotionInput!){ updatePromotion(input:$i){ __typename ... on Promotion{ id } ... on ErrorResult{ message } } }`, { i: input })).updatePromotion
      : (await x(`mutation($i:CreatePromotionInput!){ createPromotion(input:$i){ __typename ... on Promotion{ id } ... on ErrorResult{ message } } }`, { i: input })).createPromotion;
    if (r.__typename !== 'Promotion') return { ok: false, message: r.message ?? 'The discount could not be saved.' };
    return { ok: true, id: r.id, message: d.id ? 'Discount saved.' : code ? `${code} is ${d.enabled ? 'active' : 'saved as paused'}.` : `The automatic discount is ${d.enabled ? 'active' : 'saved as paused'}.` };
  } catch (e) { return fail(e); }
}
export async function setDiscountEnabled(x: Exec, id: string, enabled: boolean): Promise<MutationResult> {
  try { const r = (await x(`mutation($i:UpdatePromotionInput!){ updatePromotion(input:$i){ __typename ... on Promotion{ id } ... on ErrorResult{ message } } }`, { i: { id, enabled } })).updatePromotion; return r.__typename === 'Promotion' ? { ok: true, message: enabled ? 'Discount resumed. Customers can use it again.' : 'Discount paused. Customers cannot use it until you resume it.' } : { ok: false, message: r.message ?? 'That did not go through.' }; } catch (e) { return fail(e); }
}
export async function deleteDiscount(x: Exec, id: string): Promise<MutationResult> {
  try { const r = (await x(`mutation($id:ID!){ deletePromotion(id:$id){ result message } }`, { id })).deletePromotion; return r?.result === 'DELETED' ? { ok: true, message: 'Discount deleted. Past orders keep what they were charged.' } : { ok: false, message: r?.message ?? 'The discount could not be deleted.' }; } catch (e) { return fail(e); }
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
export async function fulfilOrder(x: Exec, orderId: string, tracking?: string, only?: { sku: string; qty: number }[]): Promise<MutationResult> {
  try { const o = (await x(`query($id:ID!){ order(id:$id){ id state lines{ id quantity productVariant{ sku } } fulfillments{ state lines{ orderLineId quantity } } } }`, { id: orderId })).order; if (!o) return { ok: false, message: 'Order not found.' };
    if (o.state === 'Cancelled') return { ok: false, message: 'This order was cancelled.' };
    const sent = new Map<string, number>(); for (const f of (o.fulfillments ?? []).filter((f: any) => f.state !== 'Cancelled')) for (const l of f.lines) sent.set(l.orderLineId, (sent.get(l.orderLineId) ?? 0) + l.quantity);
    const want = only ? new Map(only.map(l => [l.sku, l.qty])) : null;
    const lines = (o.lines as { id: string; quantity: number; productVariant: { sku: string } }[]).map(l => { const left = l.quantity - (sent.get(l.id) ?? 0); const q = want ? Math.min(left, Math.max(0, Math.floor(want.get(l.productVariant.sku) ?? 0))) : left; return { orderLineId: l.id, quantity: q }; }).filter(l => l.quantity > 0);
    if (!lines.length) return { ok: false, message: want ? 'Choose at least one item to send.' : 'This order is already fulfilled.' };
    const r = (await x(`mutation($i: FulfillOrderInput!){ addFulfillmentToOrder(input:$i){ __typename ... on Fulfillment { id } ... on ErrorResult { message } } }`, { i: { lines, handler: { code: 'manual-fulfillment', arguments: [{ name: 'method', value: 'Manual' }, { name: 'trackingCode', value: tracking ?? '' }] } } })).addFulfillmentToOrder;
    if (r.__typename !== 'Fulfillment') return { ok: false, message: r.message ?? 'The order could not be fulfilled.' };
    const t = (await x(`mutation($id:ID!){ transitionFulfillmentToState(id:$id, state:"Shipped"){ __typename ... on ErrorResult { message } } }`, { id: r.id })).transitionFulfillmentToState; const bad = errorResult(t); if (bad) return { ok: false, message: bad };
    const partial = lines.some(l => { const full = (o.lines as any[]).find(q => q.id === l.orderLineId)!.quantity; return l.quantity < full - (sent.get(l.orderLineId) ?? 0); }) || (o.lines as any[]).some(q => !lines.find(l => l.orderLineId === q.id) && q.quantity - (sent.get(q.id) ?? 0) > 0);
    const what = partial ? 'Part of the order is marked as fulfilled' : 'Marked as fulfilled';
    return { ok: true, message: tracking ? `${what} with tracking ${tracking}. The customer is told by email.` : `${what}. The customer is told by email.` };
  } catch (e) { return fail(e); }
}
export async function cancelOrder(x: Exec, i: { orderId: string; reason: string; refund: boolean }): Promise<MutationResult> {
  try {
    const o = await getOrder(x, i.orderId); if (!o) return { ok: false, message: 'Order not found.' };
    if (o.state === 'cancelled') return { ok: false, message: 'This order is already cancelled.' };
    if (o.fulfilment !== 'unfulfilled') return { ok: false, message: 'Part of this order has already been sent, so it cannot be cancelled. Refund what is needed instead.' };
    const hadPaid = o.payment === 'paid';
    const r = (await x(`mutation($i: CancelOrderInput!){ cancelOrder(input:$i){ __typename ... on Order { id state } ... on ErrorResult { message } } }`, { i: { orderId: i.orderId, reason: i.reason.slice(0, 200), cancelShipping: true } })).cancelOrder;
    if (r.__typename !== 'Order') return { ok: false, message: r.message ?? 'The order could not be cancelled.' };
    if (i.refund && hadPaid) { const f = await refundOrder(x, { orderId: i.orderId, amountMinor: o.totalMinor - o.refundedMinor, reason: i.reason, restock: false, refundFee: true }); if (!f.ok) return { ok: true, message: `Order cancelled and its stock released, but the refund did not go through: ${f.message} Refund it from the order page.` }; return { ok: true, message: `Order cancelled and ${(f.message.replace(/^Refunded /, 'refunded ')).replace(/\.$/, '')}.` }; }
    return { ok: true, message: hadPaid ? 'Order cancelled and its stock released. The customer has not been refunded yet.' : 'Order cancelled and its stock released.' };
  } catch (e) { return fail(e); }
}
export async function addOrderNote(x: Exec, orderId: string, note: string): Promise<MutationResult> {
  try { const n = note.trim(); if (!n) return { ok: false, message: 'Write a note first.' }; if (n.length > 2000) return { ok: false, message: 'Notes are limited to 2,000 characters.' };
    const r = (await x(`mutation($i: AddNoteToOrderInput!){ addNoteToOrder(input:$i){ id } }`, { i: { id: orderId, note: n, isPublic: false } })).addNoteToOrder; return r?.id ? { ok: true, message: 'Note added. Only your team can see it.' } : { ok: false, message: 'The note could not be saved.' };
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

// ---- Collections ----
const COLLECTION = `id name filters{ code args{ name value } } productVariants(options:{ take: 200 }){ totalItems items{ product{ id name } } }`;
type RawCollection = { id: string; name: string; filters: RawOperation[]; productVariants: { totalItems: number; items: { product: { id: string; name: string } }[] } };
export function mapCollection(c: RawCollection): Collection {
  const f = c.filters[0]; const products = new Map<string, string>(); for (const v of c.productVariants.items) products.set(v.product.id, v.product.name);
  const base = { id: c.id, name: c.name, count: c.productVariants.totalItems, products: [...products.values()] };
  if (c.filters.length === 1 && f.code === 'variant-name-filter') return { ...base, kind: 'rule', contains: String(arg(f, 'term') ?? '') };
  if (c.filters.length === 1 && f.code === 'variant-id-filter') return { ...base, kind: 'manual', contains: '', productIds: [...products.keys()] };
  return { ...base, kind: 'other', contains: '' };
}
export async function listCollections(x: Exec): Promise<Collection[]> { return ((await x(`query{ collections(options:{ take: 100 }){ items{ ${COLLECTION} } } }`)).collections.items as RawCollection[]).map(mapCollection); }
export async function saveCollection(x: Exec, c: CollectionInput): Promise<MutationResult> {
  try {
    const name = c.name.trim(); if (!name) return { ok: false, message: 'Give the collection a name.' }; if (name.length > 80) return { ok: false, message: 'Keep the name under 80 characters.' };
    let filter: { code: string; arguments: { name: string; value: string }[] }; let preview = 0;
    if (c.kind === 'rule') { const term = (c.contains ?? '').trim(); if (!term) return { ok: false, message: 'Add a word to match.' }; filter = { code: 'variant-name-filter', arguments: [{ name: 'operator', value: 'contains' }, { name: 'term', value: term }] }; preview = (await previewCollection(x, { kind: 'name', contains: term })).totalItems; }
    else {
      if (!c.productIds?.length) return { ok: false, message: 'Choose at least one product.' };
      const own = await listDiscountProducts(x); const picked = own.filter(p => c.productIds!.includes(p.id)); if (picked.length !== new Set(c.productIds).size) return { ok: false, message: 'One of the chosen products is not in your catalogue.' };
      const variantIds = picked.flatMap(p => p.variantIds); filter = { code: 'variant-id-filter', arguments: [{ name: 'variantIds', value: JSON.stringify(variantIds) }, { name: 'combineWithAnd', value: 'false' }] }; preview = variantIds.length;
    }
    if (!preview) return { ok: false, message: 'Nothing matches that yet. A collection with no products would show an empty page on your website.' };
    const dup = (await listCollections(x)).find(o => o.id !== c.id && o.name.toLowerCase() === name.toLowerCase()); if (dup) return { ok: false, message: `A collection called ${name} already exists.` };
    const translations = [{ languageCode: 'en', name, slug: slugify(name), description: '' }];
    const r = c.id ? (await x(`mutation($i: UpdateCollectionInput!){ updateCollection(input:$i){ id } }`, { i: { id: c.id, filters: [filter], translations } })).updateCollection : (await x(`mutation($i: CreateCollectionInput!){ createCollection(input:$i){ id } }`, { i: { filters: [filter], translations } })).createCollection;
    return r?.id ? { ok: true, id: r.id, message: c.id ? `${name} saved.` : `${name} created with ${preview} variant${preview > 1 ? 's' : ''}.` } : { ok: false, message: 'The collection could not be saved.' };
  } catch (e) { return fail(e); }
}
export async function deleteCollection(x: Exec, id: string): Promise<MutationResult> {
  try { const r = (await x(`mutation($id:ID!){ deleteCollection(id:$id){ result message } }`, { id })).deleteCollection; return r?.result === 'DELETED' ? { ok: true, message: 'Collection deleted. The products themselves are untouched.' } : { ok: false, message: r?.message ?? 'The collection could not be deleted.' }; } catch (e) { return fail(e); }
}

// ---- Customer detail ----
export async function getCustomer(x: Exec, id: string): Promise<CustomerDetail | null> {
  const c = (await x(`query($id:ID!){ customer(id:$id){ id title firstName lastName emailAddress phoneNumber createdAt
    addresses{ fullName streetLine1 streetLine2 city postalCode country{ name } }
    orders(options:{ take: 100, sort:{ orderPlacedAt: DESC }, filter:{ active:{ eq:false } } }){ items{ ${ORDER} } }
    history(options:{ take: 100, sort:{ createdAt: DESC } }){ items{ id type createdAt data administrator{ firstName lastName } } } } }`, { id })).customer;
  if (!c) return null;
  const orders = (c.orders.items as RawOrder[]).filter(o => o.orderPlacedAt).map(mapOrder); const sales = orders.filter(o => o.payment === 'paid' || o.payment === 'partially_refunded' || o.payment === 'refunded');
  const spent = sales.reduce((s, o) => s + o.totalMinor - o.refundedMinor, 0);
  return { id: c.id, firstName: c.firstName ?? '', lastName: c.lastName ?? '', name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.emailAddress, email: c.emailAddress, phone: c.phoneNumber ?? '', since: c.createdAt, marketing: false,
    orders: orders.length, spentMinor: spent, aovMinor: sales.length ? Math.round(sales.reduce((s, o) => s + o.totalMinor, 0) / sales.length) : 0, lastOrder: orders[0]?.placedAt ?? '',
    addresses: (c.addresses as { fullName?: string; streetLine1?: string; streetLine2?: string; city?: string; postalCode?: string; country?: { name: string } }[]).map(a => [a.fullName, a.streetLine1, a.streetLine2, a.city, a.postalCode, a.country?.name].filter(Boolean).join(', ')),
    recentOrders: orders.slice(0, 20).map(o => ({ id: o.id, number: o.number, placedAt: o.placedAt, totalMinor: o.totalMinor, payment: o.payment, fulfilment: o.fulfilment, items: o.lines.map(l => `${l.qty} × ${l.title}`).join(', ') })),
    notes: (c.history.items as { id: string; type: string; createdAt: string; data: { note?: string }; administrator: { firstName: string; lastName: string } | null }[]).filter(h => h.type === 'CUSTOMER_NOTE' && typeof h.data.note === 'string').map(h => ({ id: h.id, text: h.data.note!, at: h.createdAt, by: h.administrator ? `${h.administrator.firstName} ${h.administrator.lastName}`.trim() : undefined })) };
}
export async function addCustomerNote(x: Exec, customerId: string, text: string): Promise<MutationResult> {
  try { const n = text.trim(); if (!n) return { ok: false, message: 'Write a note first.' }; if (n.length > 2000) return { ok: false, message: 'Notes are limited to 2,000 characters.' };
    const r = (await x(`mutation($i: AddNoteToCustomerInput!){ addNoteToCustomer(input:$i){ id } }`, { i: { id: customerId, note: n, isPublic: false } })).addNoteToCustomer; return r?.id ? { ok: true, message: 'Note added. Only your team can see it.' } : { ok: false, message: 'The note could not be saved.' };
  } catch (e) { return fail(e); }
}
export async function deleteCustomerNote(x: Exec, noteId: string): Promise<MutationResult> {
  try { const r = (await x(`mutation($id:ID!){ deleteCustomerNote(id:$id){ result message } }`, { id: noteId })).deleteCustomerNote; return r?.result === 'DELETED' ? { ok: true, message: 'Note deleted.' } : { ok: false, message: r?.message ?? 'The note could not be deleted.' }; } catch (e) { return fail(e); }
}
export async function updateCustomerProfile(x: Exec, id: string, p: CustomerProfile): Promise<MutationResult> {
  try { if (!p.firstName.trim() && !p.lastName.trim()) return { ok: false, message: 'Enter a name.' }; if (p.phone && !/^[+()\d\s-]{6,24}$/.test(p.phone)) return { ok: false, message: 'Enter a phone number with digits, spaces, + or dashes.' };
    const r = (await x(`mutation($i: UpdateCustomerInput!){ updateCustomer(input:$i){ __typename ... on Customer{ id } ... on ErrorResult{ message } } }`, { i: { id, firstName: p.firstName.trim(), lastName: p.lastName.trim(), phoneNumber: p.phone.trim() } })).updateCustomer;
    return r.__typename === 'Customer' ? { ok: true, message: 'Customer details saved.' } : { ok: false, message: r.message ?? 'The details could not be saved.' };
  } catch (e) { return fail(e); }
}

// ---- Orders taken by hand ----
export async function listOrderableItems(x: Exec): Promise<OrderableItem[]> {
  const r = (await x(`query{ products(options:{ take: 500, sort:{ name:ASC }, filter:{ enabled:{ eq:true } } }){ items{ id name variants{ id sku name enabled priceWithTax stockOnHand stockAllocated outOfStockThreshold } } } }`)).products.items as { id: string; name: string; variants: { id: string; sku: string; name: string; enabled: boolean; priceWithTax: number; stockOnHand: number; stockAllocated: number }[] }[];
  return r.flatMap(p => p.variants.filter(v => v.enabled).map(v => ({ variantId: v.id, productId: p.id, title: p.name, variant: v.name.startsWith(p.name) ? v.name.slice(p.name.length).trim() || undefined : v.name, sku: v.sku, priceMinor: v.priceWithTax, available: Math.max(v.stockOnHand - v.stockAllocated, 0) })));
}
export async function listShippingChoices(x: Exec): Promise<ShippingChoice[]> { return ((await x(`query{ shippingMethods(options:{ take: 50 }){ items{ id name } } }`)).shippingMethods.items as ShippingChoice[]).map(m => ({ id: m.id, name: m.name })); }
const PAY_LABEL = { cash: 'Cash', card_in_person: 'Card, in person', bank_transfer: 'Bank transfer', other: 'Paid another way' } as const;
/**
 * Creates a draft order, fills it in, then takes the payment you say you received and places it. If any step fails the draft is deleted,
 * so a half-made order is never left behind. Manual payments are recorded as received; they do not go through Stripe, so they carry no platform fee.
 */
export async function createManualOrder(x: Exec, i: ManualOrderInput): Promise<MutationResult> {
  let draft: string | undefined;
  try {
    const items = i.items.filter(l => l.qty > 0); if (!items.length) return { ok: false, message: 'Add at least one item.' };
    if (items.some(l => !Number.isInteger(l.qty) || l.qty > 999)) return { ok: false, message: 'Quantities must be whole numbers up to 999.' };
    if (!PAY_LABEL[i.payment]) return { ok: false, message: 'Choose how it was paid.' };
    if (!i.shippingMethodId) return { ok: false, message: 'Choose a delivery option. For a sale in person, add a free "Collection" option under Settings, then Delivery, and choose that.' };
    if ('email' in i.customer && !/^\S+@\S+\.\S+$/.test(i.customer.email)) return { ok: false, message: 'Enter a valid email address for the customer.' };
    // Stock first, so the merchant hears "only 2 left" instead of a failed order.
    const stock = new Map((await listOrderableItems(x)).map(v => [v.variantId, v])); for (const l of items) { const v = stock.get(l.variantId); if (!v) return { ok: false, message: 'One of the items is not available to sell.' }; if (l.qty > v.available) return { ok: false, message: `Only ${v.available} of ${v.title}${v.variant ? ` (${v.variant})` : ''} in stock.` }; }
    draft = (await x(`mutation{ createDraftOrder{ id } }`)).createDraftOrder.id as string;
    for (const l of items) { const r = (await x(`mutation($o:ID!,$i:AddItemToDraftOrderInput!){ addItemToDraftOrder(orderId:$o, input:$i){ __typename ... on ErrorResult{ message } } }`, { o: draft, i: { productVariantId: l.variantId, quantity: l.qty } })).addItemToDraftOrder; if (r.__typename !== 'Order') throw new Error(r.message ?? 'An item could not be added.'); }
    const c = (await x(`mutation($o:ID!,$id:ID,$in:CreateCustomerInput){ setCustomerForDraftOrder(orderId:$o, customerId:$id, input:$in){ __typename ... on ErrorResult{ message } } }`, { o: draft, ...('id' in i.customer ? { id: i.customer.id } : { in: { emailAddress: i.customer.email.trim(), firstName: i.customer.firstName.trim() || 'Customer', lastName: i.customer.lastName.trim() || '-', phoneNumber: i.customer.phone?.trim() || undefined } }) })).setCustomerForDraftOrder;
    if (c.__typename !== 'Order') throw new Error(c.message ?? 'The customer could not be set.');
    if (i.address) await x(`mutation($o:ID!,$i:CreateAddressInput!){ setDraftOrderShippingAddress(orderId:$o, input:$i){ id } }`, { o: draft, i: { fullName: i.address.fullName, streetLine1: i.address.line1, streetLine2: i.address.line2 || undefined, city: i.address.city, postalCode: i.address.postcode, countryCode: 'GB' } });
    if (i.shippingMethodId) { const r = (await x(`mutation($o:ID!,$s:ID!){ setDraftOrderShippingMethod(orderId:$o, shippingMethodId:$s){ __typename ... on ErrorResult{ message } } }`, { o: draft, s: i.shippingMethodId })).setDraftOrderShippingMethod; if (r.__typename !== 'Order') throw new Error(r.message ?? 'That delivery option does not apply to this order.'); }
    if (i.coupon?.trim()) { const r = (await x(`mutation($o:ID!,$c:String!){ applyCouponCodeToDraftOrder(orderId:$o, couponCode:$c){ __typename ... on ErrorResult{ message } } }`, { o: draft, c: i.coupon.trim().toUpperCase() })).applyCouponCodeToDraftOrder; if (r.__typename !== 'Order') throw new Error(r.message ?? 'That discount code does not work.'); }
    const t = (await x(`mutation($id:ID!){ transitionOrderToState(id:$id, state:"ArrangingPayment"){ __typename ... on OrderStateTransitionError{ message transitionError } } }`, { id: draft })).transitionOrderToState; if (t.__typename !== 'Order') throw new Error(t.transitionError ?? t.message ?? 'The order could not be prepared for payment.');
    const p = (await x(`mutation($i:ManualPaymentInput!){ addManualPaymentToOrder(input:$i){ __typename ... on Order{ id code state } ... on ErrorResult{ message } } }`, { i: { orderId: draft, method: PAY_LABEL[i.payment], transactionId: `manual-${Date.now().toString(36)}`, metadata: {} } })).addManualPaymentToOrder; if (p.__typename !== 'Order') throw new Error(p.message ?? 'The payment could not be recorded.');
    const placed = draft; draft = undefined;
    if (i.note?.trim()) await x(`mutation($i: AddNoteToOrderInput!){ addNoteToOrder(input:$i){ id } }`, { i: { id: placed, note: i.note.trim().slice(0, 2000), isPublic: false } });
    return { ok: true, id: placed, message: `Order placed and marked as paid (${PAY_LABEL[i.payment].toLowerCase()}). Stock is reserved.` };
  } catch (e) {
    if (draft) { try { await x(`mutation($id:ID!){ deleteDraftOrder(orderId:$id){ result } }`, { id: draft }); } catch { /* the draft can be removed later; nothing was charged */ } }
    return fail(e);
  }
}
