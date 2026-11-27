import gql from 'graphql-tag';
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject, Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Allow, Ctx, Permission, RequestContext, TransactionalConnection } from '@vendure/core';
import { CellPlugin } from './plugin.ts';
import { BOT, FLAG, cleanPath, dailyHash, deviceOf, sourceOf, today, type VisitKind } from './visitors-pure.ts';
export { cleanPath, dailyHash, deviceOf, sourceOf, today } from './visitors-pure.ts';

/**
 * Visitor analytics that needs no cookie and keeps nothing about a person.
 *  - No cookie, no local storage and no fingerprint stored on the shopper's device.
 *  - The same visitor on the same day is recognised by a hash of (address, browser) mixed with a secret salt that changes every day. The address is never stored, and a hash cannot be linked from one day to the next.
 *  - Hashes are deleted after two days; only day-level totals remain (pages, sources, funnel counts) for 13 months.
 * This is the kind of measurement that does not read from or write to the shopper's device. Have your legal adviser confirm it for your own privacy policy.
 */

@Entity('oss_visit')
export class OssVisit {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Index() @Column({ type: 'varchar', length: 10 }) day!: string;
  @Column({ type: 'varchar', length: 16 }) hash!: string;
  /** Which funnel steps this visitor reached today, as bit flags. */
  @Column({ type: 'int', default: 0 }) steps!: number;
  @Column({ type: 'int', default: 0 }) pages!: number;
  @Column({ type: 'varchar', length: 60 }) source!: string;
  @Column({ type: 'varchar', length: 1 }) device!: string;
}
@Entity('oss_pageday')
export class OssPageDay {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Index() @Column({ type: 'varchar', length: 10 }) day!: string;
  @Column({ type: 'varchar', length: 200 }) path!: string;
  @Column({ type: 'int', default: 0 }) views!: number;
}
export const visitorShopExtensions = gql`
  input VisitInput { kind: String! path: String! referrer: String width: Int }
  extend type Mutation { trackVisit(input: VisitInput!): Boolean! }
`;
export const visitorAdminExtensions = gql`
  type VisitorFunnel { visited: Int! viewedProduct: Int! addedToCart: Int! startedCheckout: Int! purchased: Int! }
  type VisitorCount { label: String! count: Int! }
  type VisitorDay { day: String! visitors: Int! pageviews: Int! }
  type VisitorStats { visitors: Int! pageviews: Int! funnel: VisitorFunnel! pages: [VisitorCount!]! sources: [VisitorCount!]! devices: [VisitorCount!]! daily: [VisitorDay!]! }
  extend type Query { visitorStats(days: Int): VisitorStats! }
`;

@Injectable()
export class VisitorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection) {}
  private visits() { return this.conn.rawConnection.getRepository(OssVisit); } private pagedays() { return this.conn.rawConnection.getRepository(OssPageDay); }
  onApplicationBootstrap() { this.timer = setInterval(() => { void this.prune().catch(() => {}); }, 6 * 3600_000); this.timer.unref(); }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }
  /** Visitor hashes live two days; day totals thirteen months. */
  async prune(now = new Date()) {
    await this.visits().createQueryBuilder().delete().where('day < :d', { d: today(new Date(now.getTime() - 2 * 86400_000)) }).execute();
    await this.pagedays().createQueryBuilder().delete().where('day < :d', { d: today(new Date(now.getTime() - 396 * 86400_000)) }).execute();
  }
  async track(ctx: RequestContext, i: { kind: string; path: string; referrer?: string; width?: number }, who: { address: string; agent: string }, now = new Date()) {
    if (!(i.kind in FLAG) || BOT.test(who.agent) || !who.agent) return true;                 // a bad or robot request is quietly ignored, never an error a page has to handle
    const channelId = String(ctx.channelId); const day = today(now); const hash = dailyHash(CellPlugin.options.controlSecret ?? CellPlugin.options.storeId, day, who.address, who.agent); const kind = i.kind as VisitKind; const path = cleanPath(i.path);
    const row = await this.visits().findOne({ where: { channelId, day, hash } });
    if (!row) await this.visits().save(this.visits().create({ channelId, day, hash, steps: FLAG[kind], pages: kind === 'page' ? 1 : 0, source: sourceOf(i.referrer), device: deviceOf(i.width) }));
    else { const steps = row.steps | FLAG[kind]; await this.visits().update(row.id, { steps, pages: row.pages + (kind === 'page' ? 1 : 0) }); }
    if (kind === 'page' || kind === 'product') {
      const pd = await this.pagedays().findOne({ where: { channelId, day, path } });
      if (pd) await this.pagedays().update(pd.id, { views: pd.views + 1 }); else await this.pagedays().save(this.pagedays().create({ channelId, day, path, views: 1 }));
    }
    return true;
  }
  async stats(ctx: RequestContext, days = 30, now = new Date()) {
    const d = Math.min(Math.max(Math.floor(days) || 30, 1), 90); const channelId = String(ctx.channelId); const from = today(new Date(now.getTime() - (d - 1) * 86400_000));
    const v = this.visits().createQueryBuilder('v').where('v.channelId = :c AND v.day >= :f', { c: channelId, f: from });
    const bit = (n: number) => `SUM(CASE WHEN (v.steps / ${n}) % 2 = 1 THEN 1 ELSE 0 END)`;
    const t = await v.clone().select(['COUNT(*) AS n', `${bit(1)} AS s1`, `${bit(2)} AS s2`, `${bit(4)} AS s3`, `${bit(8)} AS s4`, `${bit(16)} AS s5`, 'SUM(v.pages) AS pages']).getRawOne();
    const grouped = async (col: 'source' | 'device') => (await v.clone().select([`v.${col} AS label`, 'COUNT(*) AS n']).groupBy(`v.${col}`).orderBy('n', 'DESC').addOrderBy('label', 'ASC').limit(8).getRawMany()).map((r: { label: string; n: string }) => ({ label: r.label, count: Number(r.n) }));
    const perDay = await v.clone().select(['v.day AS day', 'COUNT(*) AS n', 'SUM(v.pages) AS pages']).groupBy('v.day').orderBy('v.day', 'ASC').getRawMany();
    const pages = (await this.pagedays().createQueryBuilder('p').select(['p.path AS label', 'SUM(p.views) AS n']).where('p.channelId = :c AND p.day >= :f', { c: channelId, f: from }).groupBy('p.path').orderBy('n', 'DESC').addOrderBy('label', 'ASC').limit(10).getRawMany()).map((r: { label: string; n: string }) => ({ label: r.label, count: Number(r.n) }));
    const dev = { m: 'Phone', t: 'Tablet', d: 'Desktop' } as Record<string, string>;
    return { visitors: Number(t?.n ?? 0), pageviews: Number(t?.pages ?? 0), funnel: { visited: Number(t?.n ?? 0), viewedProduct: Number(t?.s2 ?? 0), addedToCart: Number(t?.s3 ?? 0), startedCheckout: Number(t?.s4 ?? 0), purchased: Number(t?.s5 ?? 0) },
      pages, sources: await grouped('source'), devices: (await grouped('device')).map(x => ({ ...x, label: dev[x.label] ?? x.label })), daily: perDay.map((r: { day: string; n: string; pages: string }) => ({ day: r.day, visitors: Number(r.n), pageviews: Number(r.pages ?? 0) })) };
  }
}
@Resolver()
export class VisitorShopResolver {
  constructor(@Inject(VisitorService) private s: VisitorService) {}
  @Mutation() @Allow(Permission.Public) trackVisit(@Ctx() ctx: RequestContext, @Args() a: { input: { kind: string; path: string; referrer?: string; width?: number } }, @Context() c: { req?: { headers?: Record<string, string | string[] | undefined>; ip?: string } }) {
    const req = c?.req;
    return this.s.track(ctx, a.input, { address: String(req?.headers?.['x-forwarded-for'] ?? req?.ip ?? '').split(',')[0].trim(), agent: String(req?.headers?.['user-agent'] ?? '') });
  }
}
@Resolver()
export class VisitorAdminResolver {
  constructor(@Inject(VisitorService) private s: VisitorService) {}
  @Query() @Allow(Permission.ReadPromotion) visitorStats(@Ctx() ctx: RequestContext, @Args() a: { days?: number }) { return this.s.stats(ctx, a.days ?? 30); }
}
