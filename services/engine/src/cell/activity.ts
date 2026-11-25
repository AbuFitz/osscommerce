import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AdministratorService, EventBus, FulfillmentEvent, OrderEvent, OrderStateTransitionEvent, Permission, ProductEvent, PromotionEvent, RefundStateTransitionEvent, RequestContext, ShippingMethodEvent, StockMovementEvent, TransactionalConnection, CustomerEvent, CollectionEvent } from '@vendure/core';

/** One line of "who did what" in one store. Written from the engine's own events, so it records every change however it was made, and is read through a channel-scoped query. */
@Entity('oss_activity')
export class OssActivity {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @CreateDateColumn() at!: Date;
  @Column({ type: 'varchar', length: 60, nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 160 }) actorName!: string;
  @Column({ type: 'varchar', length: 60 }) action!: string;
  @Column({ type: 'varchar', length: 400 }) summary!: string;
  @Column({ type: 'varchar', length: 40, nullable: true }) subjectType!: string | null;
  @Column({ type: 'varchar', length: 60, nullable: true }) subjectId!: string | null;
}
export interface ActivityInput { action: string; summary: string; subjectType?: string; subjectId?: string | number }

/** The platform team's own sessions are named as such, never as a store's staff. */
export const PLATFORM_ACTOR = 'OneSimpleSite team';
const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const ORDER_STATES: Record<string, string> = { Shipped: 'Marked order as fulfilled', PartiallyShipped: 'Part-fulfilled order', Delivered: 'Marked order as delivered', Cancelled: 'Cancelled order' };
const nameOf = (e: unknown, fallback: string) => { const x = e as { name?: string; translations?: { name?: string }[] }; return x?.name || x?.translations?.[0]?.name || fallback; };

@Injectable()
export class ActivityService implements OnApplicationBootstrap {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(EventBus) private bus: EventBus, @Inject(AdministratorService) private admins: AdministratorService) {}
  private repo() { return this.conn.rawConnection.getRepository(OssActivity); }

  /** Who is acting: a store's own staff by name, the platform team as such, nobody for system work. */
  private async actor(ctx: RequestContext): Promise<{ id: string | null; name: string } | null> {
    if (ctx.apiType !== 'admin' || !ctx.activeUserId) return null;
    if (ctx.session?.user?.channelPermissions?.some(c => c.permissions.includes(Permission.SuperAdmin))) return { id: null, name: PLATFORM_ACTOR };
    const a = await this.admins.findOneByUserId(ctx, ctx.activeUserId); return { id: a ? String(a.id) : null, name: a ? `${a.firstName} ${a.lastName}`.trim() || a.emailAddress : 'A team member' };
  }
  /** Records a change made by a named person who has no session yet (for example, someone setting their password from an emailed link). */
  async recordAs(ctx: RequestContext, who: { id: string; name: string }, e: ActivityInput): Promise<void> {
    try { await this.repo().save(this.repo().create({ channelId: String(ctx.channelId), actorId: who.id, actorName: who.name, action: e.action, summary: e.summary.slice(0, 400), subjectType: e.subjectType ?? null, subjectId: e.subjectId == null ? null : String(e.subjectId) })); } catch { /* the log must never block the change it describes */ }
  }
  async record(ctx: RequestContext, e: ActivityInput): Promise<void> {
    try {
      const who = await this.actor(ctx); if (!who) return; const channelId = String(ctx.channelId); const subjectId = e.subjectId == null ? null : String(e.subjectId);
      // Saving one thing often fires several events at once; one line is enough.
      const last = await this.repo().findOne({ where: { channelId }, order: { id: 'DESC' } });
      if (last && last.action === e.action && last.subjectId === subjectId && last.actorName === who.name && last.summary === e.summary.slice(0, 400) && Date.now() - last.at.getTime() < 5000) return;
      await this.repo().insert({ channelId, actorId: who.id, actorName: who.name, action: e.action, summary: e.summary.slice(0, 400), subjectType: e.subjectType ?? null, subjectId });
    } catch { /* the log must never break the action it describes */ }
  }
  async list(ctx: RequestContext, o: { take?: number; before?: number; actor?: string }) {
    const take = Math.min(Math.max(o.take ?? 50, 1), 200); const qb = this.repo().createQueryBuilder('a').where('a.channelId = :c', { c: String(ctx.channelId) }).orderBy('a.id', 'DESC').take(take + 1);
    if (o.before) qb.andWhere('a.id < :b', { b: o.before }); if (o.actor) qb.andWhere('a.actorName = :n', { n: o.actor });
    const rows = await qb.getMany(); return { items: rows.slice(0, take).map(r => ({ id: r.id, at: r.at, actor: r.actorName, action: r.action, summary: r.summary, subjectType: r.subjectType, subjectId: r.subjectId })), hasMore: rows.length > take };
  }

  onApplicationBootstrap() {
    this.bus.ofType(OrderStateTransitionEvent).subscribe(e => { const s = ORDER_STATES[e.toState]; if (s) void this.record(e.ctx, { action: `order.${e.toState.toLowerCase()}`, summary: `${s} ${e.order.code}`, subjectType: 'order', subjectId: e.order.id }); });
    this.bus.ofType(RefundStateTransitionEvent).subscribe(e => { if (e.toState === 'Settled' || e.toState === 'Pending') void this.record(e.ctx, { action: 'order.refund', summary: `Refunded ${money(e.refund.total)} on order ${e.order.code}`, subjectType: 'order', subjectId: e.order.id }); });
    this.bus.ofType(OrderEvent).subscribe(e => { const i = e.input as { adjustOrderLines?: unknown; addItems?: unknown; surcharges?: unknown } | undefined; if (e.type === 'updated' && (i?.adjustOrderLines || i?.addItems || i?.surcharges)) void this.record(e.ctx, { action: 'order.edited', summary: `Edited order ${e.order.code}`, subjectType: 'order', subjectId: e.order.id }); });
    this.bus.ofType(FulfillmentEvent).subscribe(e => { if (e.type === 'created') void this.record(e.ctx, { action: 'order.fulfilment', summary: 'Created a fulfilment', subjectType: 'fulfilment', subjectId: e.entity.id }); });
    this.bus.ofType(ProductEvent).subscribe(e => void this.record(e.ctx, { action: `product.${e.type}`, summary: `${{ created: 'Added', updated: 'Updated', deleted: 'Deleted' }[e.type]} product ${nameOf(e.entity, '')}`.trim(), subjectType: 'product', subjectId: e.entity.id }));
    this.bus.ofType(PromotionEvent).subscribe(e => void this.record(e.ctx, { action: `discount.${e.type}`, summary: `${{ created: 'Created', updated: 'Changed', deleted: 'Deleted' }[e.type]} discount ${nameOf(e.entity, '')}`.trim(), subjectType: 'discount', subjectId: e.entity.id }));
    this.bus.ofType(ShippingMethodEvent).subscribe(e => void this.record(e.ctx, { action: `delivery.${e.type}`, summary: `${{ created: 'Added', updated: 'Changed', deleted: 'Removed' }[e.type]} delivery option ${nameOf(e.entity, '')}`.trim(), subjectType: 'delivery', subjectId: e.entity.id }));
    this.bus.ofType(CollectionEvent).subscribe(e => void this.record(e.ctx, { action: `collection.${e.type}`, summary: `${{ created: 'Created', updated: 'Changed', deleted: 'Deleted' }[e.type]} collection ${nameOf(e.entity, '')}`.trim(), subjectType: 'collection', subjectId: e.entity.id }));
    this.bus.ofType(CustomerEvent).subscribe(e => { if (e.type === 'updated') void this.record(e.ctx, { action: 'customer.updated', summary: `Updated customer ${e.entity.firstName} ${e.entity.lastName}`.trim(), subjectType: 'customer', subjectId: e.entity.id }); });
    this.bus.ofType(StockMovementEvent).subscribe(e => { if (e.type === 'ADJUSTMENT') void this.record(e.ctx, { action: 'stock.adjusted', summary: 'Changed stock by hand', subjectType: 'stock' }); });
  }
}
