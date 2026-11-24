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
