import gql from 'graphql-tag';
import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Allocation, Cancellation, Ctx, Release, RequestContext, Sale, TransactionalConnection } from '@vendure/core';

/** Which order a stock movement belongs to. Vendure declares `Allocation.orderLine` as non-null although some rows have none, and does not expose it on sales at all, so asking for it breaks whole queries. This adds a safe, nullable `orderRef` to each movement that has an order line.
 *  It is reached only through a variant's own stock movements, which the engine already scopes to the store's channel. */
export const stockApiExtensions = gql`
  type StockOrderRef { id: ID! code: String! }
  extend type Allocation { orderRef: StockOrderRef }
  extend type Sale { orderRef: StockOrderRef }
  extend type Cancellation { orderRef: StockOrderRef }
  extend type Release { orderRef: StockOrderRef }
`;

async function orderRef(connection: TransactionalConnection, ctx: RequestContext, entity: typeof Allocation | typeof Sale | typeof Cancellation | typeof Release, id: string | number) {
  const row = await connection.getRepository(ctx, entity as never).findOne({ where: { id } as never, relations: { orderLine: { order: true } } as never }) as { orderLine?: { order?: { id: string | number; code: string } } } | null;
  const o = row?.orderLine?.order; return o ? { id: o.id, code: o.code } : null;
}
@Resolver('Allocation') export class AllocationOrderRef { constructor(@Inject(TransactionalConnection) private c: TransactionalConnection) {} @ResolveField() orderRef(@Ctx() ctx: RequestContext, @Parent() p: { id: string | number }) { return orderRef(this.c, ctx, Allocation, p.id); } }
@Resolver('Sale') export class SaleOrderRef { constructor(@Inject(TransactionalConnection) private c: TransactionalConnection) {} @ResolveField() orderRef(@Ctx() ctx: RequestContext, @Parent() p: { id: string | number }) { return orderRef(this.c, ctx, Sale, p.id); } }
@Resolver('Cancellation') export class CancellationOrderRef { constructor(@Inject(TransactionalConnection) private c: TransactionalConnection) {} @ResolveField() orderRef(@Ctx() ctx: RequestContext, @Parent() p: { id: string | number }) { return orderRef(this.c, ctx, Cancellation, p.id); } }
@Resolver('Release') export class ReleaseOrderRef { constructor(@Inject(TransactionalConnection) private c: TransactionalConnection) {} @ResolveField() orderRef(@Ctx() ctx: RequestContext, @Parent() p: { id: string | number }) { return orderRef(this.c, ctx, Release, p.id); } }
export const STOCK_RESOLVERS = [AllocationOrderRef, SaleOrderRef, CancellationOrderRef, ReleaseOrderRef];
