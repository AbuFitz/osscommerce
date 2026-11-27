import gql from 'graphql-tag';
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Allow, Customer, CustomerGroupService, Ctx, LanguageCode, Permission, Promotion, PromotionService, RequestContext, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';
import { ActivityService } from './activity.ts';

/** Which customer group and promotion make up a store's trade pricing. Kept so we never guess by name. */
@Entity('oss_trade')
export class OssTrade {
  @PrimaryGeneratedColumn() id!: number;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Column({ type: 'varchar', length: 60 }) groupId!: string;
  @Column({ type: 'varchar', length: 60 }) promotionId!: string;
}
export const tradeApiExtensions = gql`
  type TradeMember { id: ID! name: String! email: String! }
  type TradePricing { percent: Float! enabled: Boolean! members: [TradeMember!]! }
  extend type Query { tradePricing: TradePricing! }
  extend type Mutation { saveTradePricing(percent: Float!, enabled: Boolean!): Boolean! setTradeCustomer(customerId: ID!, member: Boolean!): Boolean! }
`;
export const MIN_TRADE_PERCENT = 1; export const MAX_TRADE_PERCENT = 90;
/** Ids are stored as text; the services want the id's own type (a number with the default strategy). */
const idOf = (v: string): string | number => (/^\d+$/.test(v) ? Number(v) : v);
const GROUP_NAME = 'Trade customers'; const PROMO_NAME = 'Trade pricing';

/**
 * Trade (wholesale) pricing: a percentage off for customers you mark as trade. Built from the engine's own customer group and an automatic promotion that only applies to that group,
 * so the discount shows on the order like any other and is audited like any other. Shoppers' catalogue prices are unchanged; trade customers see the reduction in their basket.
 */
@Injectable()
export class TradeService {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(CustomerGroupService) private groups: CustomerGroupService, @Inject(PromotionService) private promos: PromotionService, @Inject(ActivityService) private activity: ActivityService) {}
  private repo() { return this.conn.rawConnection.getRepository(OssTrade); }
  private async mine(ctx: RequestContext, customerId: string) {
    const c = await this.conn.getRepository(ctx, Customer).createQueryBuilder('c').innerJoin('c.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).where('c.id = :id AND c.deletedAt IS NULL', { id: customerId }).getOne();
    if (!c) throw new UserInputError('That customer was not found.'); return c;
  }
  private args(percent: number, groupId: string) { return { conditions: [{ code: 'customer_group', arguments: [{ name: 'customerGroupId', value: groupId }] }], actions: [{ code: 'order_percentage_discount', arguments: [{ name: 'discount', value: String(percent) }] }] }; }
  private async ensure(ctx: RequestContext, percent: number, enabled: boolean) {
    const channelId = String(ctx.channelId); let row = await this.repo().findOne({ where: { channelId } });
    if (!row) {
      const g = await this.groups.create(ctx, { name: GROUP_NAME, customerIds: [] });
      const p = await this.promos.createPromotion(ctx, { enabled, ...this.args(percent, String(g.id)), translations: [{ languageCode: LanguageCode.en, name: PROMO_NAME, description: 'Automatic discount for customers marked as trade.' }] }) as Promotion & { message?: string };
      if (!(p instanceof Promotion)) throw new UserInputError((p as { message?: string }).message ?? 'Trade pricing could not be set up.');
      row = await this.repo().save(this.repo().create({ channelId, groupId: String(g.id), promotionId: String(p.id) })); return row;
    }
    return row;
  }
  async view(ctx: RequestContext) {
    const row = await this.repo().findOne({ where: { channelId: String(ctx.channelId) } }); if (!row) return { percent: 0, enabled: false, members: [] };
    const promo = await this.promos.findOne(ctx, idOf(row.promotionId)); const pct = Number(promo?.actions?.[0]?.args?.find((a: { name: string }) => a.name === 'discount')?.value ?? 0);
    const members = (await this.groups.getGroupCustomers(ctx, idOf(row.groupId), { take: 500 })).items;
    return { percent: Number.isFinite(pct) ? pct : 0, enabled: !!promo?.enabled, members: members.map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim() || m.emailAddress, email: m.emailAddress })) };
  }
  async save(ctx: RequestContext, percent: number, enabled: boolean) {
    if (!Number.isFinite(percent) || percent < MIN_TRADE_PERCENT || percent > MAX_TRADE_PERCENT) throw new UserInputError(`Choose a trade discount from ${MIN_TRADE_PERCENT}% to ${MAX_TRADE_PERCENT}%.`);
    const p = Math.round(percent * 10) / 10; const row = await this.ensure(ctx, p, enabled);
    const r = await this.promos.updatePromotion(ctx, { id: idOf(row.promotionId), enabled, ...this.args(p, row.groupId), translations: [{ languageCode: LanguageCode.en, name: PROMO_NAME, description: 'Automatic discount for customers marked as trade.' }] }) as Promotion & { message?: string }; if (!(r instanceof Promotion)) throw new UserInputError((r as { message?: string }).message ?? 'Trade pricing could not be saved.');
    await this.activity.record(ctx, { action: 'trade.pricing', summary: enabled ? `Set trade pricing to ${p}% off` : 'Turned trade pricing off', subjectType: 'promotion', subjectId: row.promotionId }); return true;
  }
  async setMember(ctx: RequestContext, customerId: string, member: boolean) {
    const c = await this.mine(ctx, customerId); const row = await this.ensure(ctx, 10, false);
    if (member) await this.groups.addCustomersToGroup(ctx, { customerGroupId: idOf(row.groupId), customerIds: [c.id] } as never); else await this.groups.removeCustomersFromGroup(ctx, { customerGroupId: idOf(row.groupId), customerIds: [c.id] } as never);
    await this.activity.record(ctx, { action: 'trade.member', summary: `${member ? 'Marked' : 'Unmarked'} ${`${c.firstName} ${c.lastName}`.trim() || 'a customer'} ${member ? 'as' : 'as no longer'} a trade customer`, subjectType: 'customer', subjectId: c.id }); return true;
  }
}
@Resolver()
export class TradeResolver {
  constructor(@Inject(TradeService) private s: TradeService) {}
  @Query() @Allow(Permission.ReadPromotion) tradePricing(@Ctx() ctx: RequestContext) { return this.s.view(ctx); }
  @Transaction() @Mutation() @Allow(Permission.UpdatePromotion) saveTradePricing(@Ctx() ctx: RequestContext, @Args() a: { percent: number; enabled: boolean }) { return this.s.save(ctx, a.percent, a.enabled); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCustomer) setTradeCustomer(@Ctx() ctx: RequestContext, @Args() a: { customerId: string; member: boolean }) { return this.s.setMember(ctx, a.customerId, a.member); }
}
