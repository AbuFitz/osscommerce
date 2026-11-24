import { LanguageCode, PromotionOrderAction } from '@vendure/core';

/** A tax-aware fixed order discount. It is capped at the basket subtotal so a promotion can never make goods total negative. */
export const fixedOrderDiscount = new PromotionOrderAction({
  code: 'oss-fixed-order-discount',
  args: { amount: { type: 'int', ui: { component: 'currency-form-input', min: 1 } } },
  execute(ctx, order, args) {
    const subtotal = ctx.channel.pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
    return -Math.min(subtotal, args.amount);
  },
  description: [{ languageCode: LanguageCode.en, value: 'Discount order by a fixed amount' }],
});

/** The value of the free items in a "buy X, get Y free" offer. Every (buy + get) units earn `get` free ones, and the cheapest units are the free ones, so the customer never gets the dearest item free. Pure so it can be tested. */
export function freeUnitsValue(unitPrices: number[], buy: number, get: number): number {
  if (!Number.isInteger(buy) || !Number.isInteger(get) || buy < 1 || get < 1) return 0;
  const free = Math.floor(unitPrices.length / (buy + get)) * get; if (free <= 0) return 0;
  return [...unitPrices].sort((a, b) => a - b).slice(0, free).reduce((s, p) => s + p, 0);
}

/** Buy X, get Y free, repeating. Unlike Vendure's built-in version, 6 units of "buy 2 get 1" earn two free items, not one. */
export const buyXGetYAction = new PromotionOrderAction({
  code: 'oss-buy-x-get-y',
  args: { buy: { type: 'int', ui: { component: 'number-form-input', min: 1 } }, get: { type: 'int', ui: { component: 'number-form-input', min: 1 } }, productVariantIds: { type: 'ID', list: true, ui: { component: 'product-selector-form-input' } } },
  execute(ctx, order, args) {
    const ids = new Set((args.productVariantIds as unknown[]).map(String)); const prices: number[] = [];
    for (const l of order.lines) if (ids.has(String(l.productVariantId))) { const p = ctx.channel.pricesIncludeTax ? l.unitPriceWithTax : l.unitPrice; for (let i = 0; i < l.quantity; i++) prices.push(p); }
    return -freeUnitsValue(prices, args.buy, args.get);
  },
  description: [{ languageCode: LanguageCode.en, value: 'Buy { buy }, get { get } free on chosen products (repeats)' }],
});
