import { ShippingCalculator, ShippingEligibilityChecker, LanguageCode, type Order } from '@vendure/core';
import { postcodeMatches } from '@oss-commerce/contracts';

/** Calculators the engine does not ship with. The engine's only built-in is a fixed rate, so "free over £50", weight bands and per-item rates need these.
 *  All amounts are in minor units and tax-inclusive when `priceIncludesTax` is true, matching how the portal's shipping page speaks. */
const L = (v: string) => [{ languageCode: LanguageCode.en, value: v }];
const money = { type: 'int' as const, ui: { component: 'currency-form-input' } };

export const flatRateFreeOver = new ShippingCalculator({
  code: 'oss-flat-rate-free-over', description: L('Flat rate, free over a basket value'),
  args: { rate: { type: 'int', ui: money.ui, label: L('Rate') }, freeOver: { type: 'int', ui: money.ui, label: L('Free when the basket is at least'), defaultValue: 0 }, includesTax: { type: 'boolean', defaultValue: true }, taxRate: { type: 'float', defaultValue: 20 } },
  calculate: (_ctx, order, a) => {
    const basket = a.includesTax ? order.subTotalWithTax : order.subTotal;
    const free = a.freeOver > 0 && basket >= a.freeOver;
    return { price: free ? 0 : a.rate, priceIncludesTax: !!a.includesTax, taxRate: a.taxRate };
  },
});

export const perItem = new ShippingCalculator({
  code: 'oss-per-item', description: L('Per item'),
  args: { first: { type: 'int', ui: money.ui, label: L('First item') }, additional: { type: 'int', ui: money.ui, label: L('Each additional item') }, includesTax: { type: 'boolean', defaultValue: true }, taxRate: { type: 'float', defaultValue: 20 } },
  calculate: (_ctx, order, a) => {
    const n = order.lines.reduce((s, l) => s + l.quantity, 0);
    return { price: n <= 0 ? 0 : a.first + (n - 1) * a.additional, priceIncludesTax: !!a.includesTax, taxRate: a.taxRate };
  },
});

export interface Band { upToGrams: number; price: number }
export const parseBands = (json: string): Band[] => { const b = JSON.parse(json) as Band[]; if (!Array.isArray(b) || !b.length || b.some(x => !(x.upToGrams > 0) || !(x.price >= 0))) throw new Error('Invalid bands'); return [...b].sort((x, y) => x.upToGrams - y.upToGrams); };
/** Total weight of an order in grams, from each variant's `weightGrams` custom field. A line with no weight counts as zero, and the order is flagged so it is not silently under-priced. */
export const orderWeight = (order: Order) => order.lines.reduce((s, l) => s + ((l.productVariant?.customFields as any)?.weightGrams ?? 0) * l.quantity, 0);

export const weightBands = new ShippingCalculator({
  code: 'oss-weight-bands', description: L('Weight bands'),
  args: { bands: { type: 'string', ui: { component: 'textarea-form-input' }, label: L('Bands as JSON: [{"upToGrams":500,"price":395}]') }, includesTax: { type: 'boolean', defaultValue: true }, taxRate: { type: 'float', defaultValue: 20 } },
  calculate: (_ctx, order, a) => {
    const bands = parseBands(a.bands); const w = orderWeight(order); const band = bands.find(b => w <= b.upToGrams) ?? bands[bands.length - 1];
    return { price: band.price, priceIncludesTax: !!a.includesTax, taxRate: a.taxRate, metadata: { weightGrams: w, band: band.upToGrams } };
  },
});

/** Country-level delivery zones owned by a merchant channel. Vendure Zone records are global,
 * so they must never be editable by store administrators. The display fields also live in the
 * checker arguments, which lets the portal reconstruct a zone without adding global records or
 * leaking one merchant's configuration to another. */
/** Everything that decides whether a delivery option is offered, kept pure so it can be tested without an engine. Empty or missing limits mean "no limit", so zones saved before these existed behave as they always did. */
export interface ZoneRule { countries: string; postcodes?: string; excludePostcodes?: string; minOrder?: number; maxOrder?: number; maxWeight?: number }
export function zoneEligible(r: ZoneRule, a: { countryCode?: string; postalCode?: string; basketMinor: number; weightGrams: number }): boolean {
  const allowed = new Set(r.countries.split(',').map(x => x.trim().toUpperCase()).filter(Boolean)); if (!a.countryCode || !allowed.has(a.countryCode.toUpperCase())) return false;
  const only = (r.postcodes ?? '').trim(); const except = (r.excludePostcodes ?? '').trim();
  if (only && !postcodeMatches(a.postalCode ?? '', only)) return false;
  if (except && postcodeMatches(a.postalCode ?? '', except)) return false;
  if (r.minOrder && a.basketMinor < r.minOrder) return false; if (r.maxOrder && a.basketMinor > r.maxOrder) return false;
  if (r.maxWeight && a.weightGrams > r.maxWeight) return false;
  return true;
}
export const deliveryZoneChecker = new ShippingEligibilityChecker({
  code: 'oss-delivery-zone', description: L('Deliver only to the selected countries, postcode areas, order values and weights'),
  args: {
    countries: { type: 'string', label: L('ISO country codes') },
    zoneName: { type: 'string', label: L('Portal zone name') },
    regionsLabel: { type: 'string', label: L('Portal regions label') },
    postcodes: { type: 'string', label: L('Only these postcode areas, ranges or outward codes'), defaultValue: '' },
    excludePostcodes: { type: 'string', label: L('Never these postcode areas (served by a more specific zone)'), defaultValue: '' },
    minOrder: { type: 'int', ui: money.ui, label: L('Only when the basket is at least'), defaultValue: 0 },
    maxOrder: { type: 'int', ui: money.ui, label: L('Only when the basket is at most'), defaultValue: 0 },
    maxWeight: { type: 'int', label: L('Only when the order weighs at most (grams)'), defaultValue: 0 },
  },
  check: (_ctx, order, a) => zoneEligible({ countries: a.countries, postcodes: a.postcodes, excludePostcodes: a.excludePostcodes, minOrder: a.minOrder, maxOrder: a.maxOrder, maxWeight: a.maxWeight },
    { countryCode: order.shippingAddress?.countryCode, postalCode: order.shippingAddress?.postalCode, basketMinor: order.subTotalWithTax, weightGrams: orderWeight(order) }),
  // Anything the answer depends on is part of the key, so a change to the basket, the weight or the address re-runs the check.
  shouldRunCheck: (_ctx, order) => ({ countryCode: order.shippingAddress?.countryCode ?? '', postalCode: order.shippingAddress?.postalCode ?? '', basket: order.subTotalWithTax, weight: orderWeight(order) }),
});
export const OSS_CALCULATORS = [flatRateFreeOver, perItem, weightBands];
