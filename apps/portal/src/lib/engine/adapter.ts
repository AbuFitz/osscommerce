import type { Order, OrderLine, PaymentStatus, FulfilmentStatus, OrderState, Product, ProductDetail, Variant, TaxClass, Customer, NewProduct, StockAdjust, RefundInput, MutationResult, VariantInput, OptionGroup } from '../gateway';
import { createProductWithVariants, findTaxCategories, type Exec } from './catalogue';

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

const PRODUCT = `id name enabled featuredAsset{ preview } optionGroups{ name options{ name } }
  variants{ id sku enabled priceWithTax stockOnHand stockAllocated outOfStockThreshold options{ name group{ name } } taxCategory{ name } customFields{ weightGrams } }`;
type RawVariant = { id: string; sku: string; enabled: boolean; priceWithTax: number; stockOnHand: number; stockAllocated: number; outOfStockThreshold: number; options: { name: string; group: { name: string } }[]; taxCategory: { name: string } | null; customFields: { weightGrams?: number } | null };
type RawProduct = { id: string; name: string; enabled: boolean; featuredAsset: { preview: string } | null; optionGroups: { name: string; options: { name: string }[] }[]; variants: RawVariant[] };
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
  const variantList: Variant[] = p.variants.map(v => ({ id: v.id, options: order.map(g => v.options.find(o => o.group.name === g)?.name ?? '').filter(Boolean), sku: v.sku, priceMinor: v.priceWithTax, onHand: v.stockOnHand, allocated: v.stockAllocated, taxClass: taxOf(v.taxCategory?.name), enabled: v.enabled, weightGrams: v.customFields?.weightGrams || undefined }));
  return { ...mapProduct(p), optionGroups: p.optionGroups.map(g => ({ name: g.name, options: g.options.map(o => o.name) })), variantList };
}
export async function listCustomers(x: Exec): Promise<Customer[]> {
  const r = await x(`query{ customers(options:{ take: 200 }){ items{ id firstName lastName emailAddress orders(options:{ take: 100, filter:{ active:{ eq:false } } }){ totalItems items{ totalWithTax orderPlacedAt } } } } }`);
  return (r.customers.items as any[]).map(c => { const os = (c.orders.items as any[]).filter(o => o.orderPlacedAt); return { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.emailAddress, orders: os.length, spentMinor: os.reduce((s, o) => s + o.totalWithTax, 0), lastOrder: os.map(o => o.orderPlacedAt).sort().at(-1) ?? '', marketing: false }; }).filter(c => c.orders > 0);
}

const fail = (e: unknown): MutationResult => ({ ok: false, message: e instanceof Error ? e.message : 'That did not go through. Nothing was changed.' });
const errorResult = (r: { __typename?: string; message?: string } | null | undefined) => (r && 'message' in r && r.message && !/^(Order|Fulfillment|Refund|Product)/.test(r.__typename ?? '') ? r.message : null);

export async function addProduct(x: Exec, p: NewProduct): Promise<MutationResult> {
  try { const sku = (p.sku || p.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 12)).toUpperCase();
    const taken = (await x(`query($s:String!){ productVariants(options:{ filter:{ sku:{ eq:$s } }, take:1 }){ totalItems } }`, { s: sku })).productVariants.totalItems; if (taken) return { ok: false, message: `SKU ${sku} is already used by another product.` };
    await createProductWithVariants(x, { title: p.title, enabled: p.status === 'published', optionGroups: [], variants: [{ options: [], sku, priceMinor: p.priceMinor, stock: p.onHand }] });
    return { ok: true, message: p.status === 'published' ? `${p.title} is published. Add photos next.` : `${p.title} saved as a draft.` };
  } catch (e) { return fail(e); }
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
    const input = d.variants.map(v => { const e = p.variantList.find(q => q.options.join('|') === v.options.join('|'))!; return { id: e.id, sku: v.sku, price: undefined as number | undefined, priceWithTaxWanted: v.priceMinor, taxCategoryId: tax[v.taxClass], stockOnHand: v.stock, enabled: v.enabled, customFields: { weightGrams: v.weightGrams ?? 0 } }; });
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
