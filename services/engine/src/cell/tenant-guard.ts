import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenError, internal_getRequestContext, TransactionalConnection, Permission, Product, ProductVariant, Collection, Asset, Promotion, ShippingMethod, Customer, CustomerHistoryEntry, Order, OrderLine, Payment, Fulfillment, type RequestContext } from '@vendure/core';
import type { EntityTarget } from 'typeorm';

/**
 * Tenant guard for the shared engine. Vendure scopes most reads to the caller's channel, but not every write, and a few operations are global by design.
 * For any administrator who is not the platform superadmin this guard:
 *   1. DEFAULT-DENIES every Admin API operation that is not on the merchant allowlist (so global operations such as channels, jobs, roles, administrators,
 *      zones, tax categories, global settings and payment methods stay closed even if a role gains a permission by mistake), and
 *   2. VERIFIES that every record the request names by id belongs to the caller's own channel before the operation runs.
 * Both are enforced on the server whatever the portal sends.
 */
const ORDER_STEPS = new Set(['ArrangingPayment', 'Modifying', 'ArrangingAdditionalPayment', 'PaymentAuthorized', 'PaymentSettled', 'PartiallyShipped', 'Shipped', 'PartiallyDelivered']);
export const MERCHANT_QUERIES = new Set(['activeAdministrator', 'activeChannel', 'product', 'products', 'productVariant', 'productVariants', 'order', 'orders', 'customer', 'customers', 'collection', 'collections', 'previewCollectionVariants', 'taxCategories', 'asset', 'assets', 'facets', 'promotions', 'promotion', 'stockLocations', 'shippingMethod', 'shippingMethods', 'countries', 'search']);
export const MERCHANT_MUTATIONS = new Set(['createProduct', 'updateProduct', 'deleteProduct', 'createProductOptionGroup', 'addOptionGroupToProduct', 'createProductVariants', 'updateProductVariants', 'deleteProductVariant', 'createCollection', 'updateCollection', 'deleteCollection',
  'createAssets', 'updateAsset', 'deleteAssets', 'addFulfillmentToOrder', 'transitionFulfillmentToState', 'refundOrder', 'modifyOrder', 'cancelOrder', 'addNoteToOrder', 'updateCustomer', 'addNoteToCustomer', 'deleteCustomerNote', 'createDraftOrder', 'deleteDraftOrder', 'addItemToDraftOrder', 'adjustDraftOrderLine', 'removeDraftOrderLine', 'setCustomerForDraftOrder', 'setDraftOrderShippingAddress', 'setDraftOrderShippingMethod', 'applyCouponCodeToDraftOrder', 'removeCouponCodeFromDraftOrder', 'transitionOrderToState', 'addManualPaymentToOrder', 'createPromotion', 'updatePromotion', 'deletePromotion',
  'createShippingMethod', 'updateShippingMethod', 'deleteShippingMethod']);

type Via = 'direct' | 'order' | 'optionGroup' | 'customerNote';
type Check = { entity: EntityTarget<any>; ids: (a: any) => unknown[]; via?: Via; /** The request is refused outright unless this holds. */ when?: (a: any) => boolean };
const arr = (v: unknown): unknown[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const inp = (a: any) => a?.input;
/** Customer groups are deliberately NOT offered to merchants: in this Vendure they are global to the engine (no channel), so one store could see or change another's.
 *  Merchants get customer notes instead, which belong to a channel-owned customer. Segments are computed in the portal. */
/** Photos a request attaches by id. Photos are channel-owned, so a store may only attach its own. */
const photos = (i: any): unknown[] => [...arr(i?.assetIds), i?.featuredAssetId];
/** Which ids each write names, and what they must belong to. Reads by id are already channel-scoped by Vendure (and covered by tests). */
export const OWNERSHIP: Record<string, Check[]> = {
  createProduct: [{ entity: Asset, ids: a => photos(inp(a)) }],
  updateProduct: [{ entity: Product, ids: a => arr(inp(a)?.id) }, { entity: Asset, ids: a => photos(inp(a)) }], deleteProduct: [{ entity: Product, ids: a => arr(a?.id) }],
  addOptionGroupToProduct: [{ entity: Product, ids: a => arr(a?.productId) }, { entity: Product, ids: a => arr(a?.optionGroupId), via: 'optionGroup' }],
  createProductVariants: [{ entity: Product, ids: a => arr(inp(a)).map((v: any) => v?.productId) }, { entity: Asset, ids: a => arr(inp(a)).flatMap((v: any) => photos(v)) }],
  updateProductVariants: [{ entity: ProductVariant, ids: a => arr(inp(a)).map((v: any) => v?.id) }, { entity: Asset, ids: a => arr(inp(a)).flatMap((v: any) => photos(v)) }], deleteProductVariant: [{ entity: ProductVariant, ids: a => arr(a?.id) }],
  createCollection: [{ entity: Asset, ids: a => photos(inp(a)) }],
  updateCollection: [{ entity: Collection, ids: a => arr(inp(a)?.id) }, { entity: Asset, ids: a => photos(inp(a)) }], deleteCollection: [{ entity: Collection, ids: a => arr(a?.id) }],
  updateAsset: [{ entity: Asset, ids: a => arr(inp(a)?.id) }], deleteAssets: [{ entity: Asset, ids: a => arr(inp(a)?.assetIds) }],
  updateCustomer: [{ entity: Customer, ids: a => arr(inp(a)?.id) }],
  deleteDraftOrder: [{ entity: Order, ids: a => arr(a?.orderId) }],
  addItemToDraftOrder: [{ entity: Order, ids: a => arr(a?.orderId) }], adjustDraftOrderLine: [{ entity: Order, ids: a => arr(a?.orderId) }, { entity: OrderLine, ids: a => arr(a?.input?.orderLineId), via: 'order' }],
  removeDraftOrderLine: [{ entity: Order, ids: a => arr(a?.orderId) }, { entity: OrderLine, ids: a => arr(a?.orderLineId), via: 'order' }],
  setCustomerForDraftOrder: [{ entity: Order, ids: a => arr(a?.orderId) }, { entity: Customer, ids: a => arr(a?.customerId) }],
  setDraftOrderShippingAddress: [{ entity: Order, ids: a => arr(a?.orderId) }], setDraftOrderShippingMethod: [{ entity: Order, ids: a => arr(a?.orderId) }, { entity: ShippingMethod, ids: a => arr(a?.shippingMethodId) }],
  applyCouponCodeToDraftOrder: [{ entity: Order, ids: a => arr(a?.orderId) }], removeCouponCodeFromDraftOrder: [{ entity: Order, ids: a => arr(a?.orderId) }],
  // Only the steps a hand-made order and an order edit need: Draft to ArrangingPayment, into and out of editing, and the extra-payment step. Cancelling, delivering and every other state change stay with the platform (cancelOrder and fulfilment have their own checks).
  transitionOrderToState: [{ entity: Order, ids: a => arr(a?.id), when: a => ORDER_STEPS.has(a?.state) }],
  addManualPaymentToOrder: [{ entity: Order, ids: a => arr(inp(a)?.orderId) }],
  addNoteToCustomer: [{ entity: Customer, ids: a => arr(inp(a)?.id) }],
  deleteCustomerNote: [{ entity: CustomerHistoryEntry, ids: a => arr(a?.id), via: 'customerNote' }],
  updatePromotion: [{ entity: Promotion, ids: a => arr(inp(a)?.id) }], deletePromotion: [{ entity: Promotion, ids: a => arr(a?.id) }],
  updateShippingMethod: [{ entity: ShippingMethod, ids: a => arr(inp(a)?.id) }], deleteShippingMethod: [{ entity: ShippingMethod, ids: a => arr(a?.id) }],
  addFulfillmentToOrder: [{ entity: OrderLine, ids: a => arr(inp(a)?.lines).map((l: any) => l?.orderLineId), via: 'order' }],
  // Editing a placed order: the order, every line it touches, every refund payment, and every item being added must all belong to this store.
  modifyOrder: [{ entity: Order, ids: a => arr(inp(a)?.orderId) }, { entity: OrderLine, ids: a => arr(inp(a)?.adjustOrderLines).map((l: any) => l?.orderLineId), via: 'order' }, { entity: Payment, ids: a => arr(inp(a)?.refunds).map((r: any) => r?.paymentId).concat(inp(a)?.refund?.paymentId ?? []), via: 'order' }, { entity: ProductVariant, ids: a => arr(inp(a)?.addItems).map((l: any) => l?.productVariantId) }],
  refundOrder: [{ entity: Payment, ids: a => arr(inp(a)?.paymentId), via: 'order' }, { entity: OrderLine, ids: a => arr(inp(a)?.lines).map((l: any) => l?.orderLineId), via: 'order' }],
  cancelOrder: [{ entity: Order, ids: a => arr(inp(a)?.orderId) }], addNoteToOrder: [{ entity: Order, ids: a => arr(inp(a)?.id) }],
  transitionFulfillmentToState: [{ entity: Fulfillment, ids: a => arr(a?.id), via: 'order' }],
};
const isOperator = (ctx: RequestContext) => !!ctx.session?.user?.channelPermissions?.some(c => c.permissions.includes(Permission.SuperAdmin));
const uniq = (v: unknown[]) => [...new Set(v.filter(x => x !== undefined && x !== null).map(String))];

@Injectable()
export class TenantGuard implements NestInterceptor {
  constructor(@Inject(TransactionalConnection) private readonly conn: TransactionalConnection) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType<string>() !== 'graphql') return next.handle();
    const gql = GqlExecutionContext.create(context); const info = gql.getInfo(); const req = gql.getContext().req;
    const ctx = internal_getRequestContext(req, context);
    if (ctx.apiType !== 'admin' || !ctx.session?.user || isOperator(ctx)) return next.handle();
    const kind: string = info.parentType.name; const field: string = info.fieldName;
    if (kind === 'Query' && !MERCHANT_QUERIES.has(field)) throw new ForbiddenError();
    if (kind === 'Mutation') {
      if (!MERCHANT_MUTATIONS.has(field)) throw new ForbiddenError();
      for (const c of OWNERSHIP[field] ?? []) await this.assertOwned(ctx, c, gql.getArgs());
    }
    return next.handle();
  }
  private inChannel(ctx: RequestContext, entity: EntityTarget<any>, ids: string[]) {
    return this.conn.getRepository(ctx, entity as any).createQueryBuilder('e').innerJoin('e.channels', 'ch').where('e.id IN (:...ids)', { ids }).andWhere('ch.id = :cid', { cid: ctx.channelId }).getCount();
  }
  private async assertOwned(ctx: RequestContext, c: Check, args: any) {
    if (c.when && !c.when(args)) throw new ForbiddenError();
    const ids = uniq(c.ids(args)); if (!ids.length) return;
    if (c.via === 'optionGroup') {
      // Option groups are not channel-aware. One already attached to another store's product must not be re-used here.
      const products = await this.conn.getRepository(ctx, Product).createQueryBuilder('p').innerJoin('p.optionGroups', 'g').where('g.id IN (:...ids)', { ids }).select('p.id', 'id').getRawMany();
      const pids = uniq(products.map(p => p.id)); if (pids.length && (await this.inChannel(ctx, Product, pids)) !== pids.length) throw new ForbiddenError(); return;
    }
    if (c.via === 'customerNote') {
      // A note is a history entry on a customer. It belongs to this store only if its customer does.
      const rows = await this.conn.getRepository(ctx, CustomerHistoryEntry).find({ where: ids.map(id => ({ id })) as any, relations: ['customer'] }); const cids = uniq(rows.map((r: any) => r.customer?.id));
      if (rows.length !== ids.length || !cids.length || (await this.inChannel(ctx, Customer, cids)) !== cids.length) throw new ForbiddenError(); return;
    }
    if (c.via === 'order') {
      const orderIds = await this.orderIdsFor(ctx, c.entity, ids);
      if (orderIds.length !== ids.length && c.entity !== Fulfillment && c.entity !== OrderLine) throw new ForbiddenError();
      if (!orderIds.length || (await this.inChannel(ctx, Order, orderIds)) !== orderIds.length) throw new ForbiddenError(); return;
    }
    if ((await this.inChannel(ctx, c.entity, ids)) !== ids.length) throw new ForbiddenError();
  }
  private async orderIdsFor(ctx: RequestContext, entity: EntityTarget<any>, ids: string[]): Promise<string[]> {
    const where = ids.map(id => ({ id })) as any;
    if (entity === Payment) return uniq((await this.conn.getRepository(ctx, Payment).find({ where, relations: ['order'] })).map((p: any) => p.order?.id));
    if (entity === OrderLine) return uniq((await this.conn.getRepository(ctx, OrderLine).find({ where, relations: ['order'] })).map((l: any) => l.order?.id));
    if (entity === Fulfillment) return uniq((await this.conn.getRepository(ctx, Fulfillment).find({ where, relations: ['lines', 'lines.orderLine', 'lines.orderLine.order'] })).flatMap((f: any) => f.lines.map((l: any) => l.orderLine?.order?.id)));
    return ids;
  }
}
