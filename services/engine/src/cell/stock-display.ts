import type { ProductVariant, RequestContext, StockDisplayStrategy } from '@vendure/core';

/**
 * What a shopper is told about stock. Vendure's default calls anything at 10 or below "low", which is wrong for a shop that sells ten a year
 * and for one that sells ten a minute. The level is a setting (LOW_STOCK_AT); the exact count is never exposed.
 */
export class ThresholdStockDisplayStrategy implements StockDisplayStrategy {
  constructor(private readonly lowAt: number) {}
  getStockLevel(_ctx: RequestContext, _variant: ProductVariant, saleable: number): string {
    return saleable <= 0 ? 'OUT_OF_STOCK' : saleable <= this.lowAt ? 'LOW_STOCK' : 'IN_STOCK';
  }
}
