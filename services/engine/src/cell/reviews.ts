import gql from 'graphql-tag';
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Allow, Ctx, Order, OrderLine, Permission, Product, RequestContext, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';
import { ActivityService } from './activity.ts';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';
/** A shopper's review of a product. Plain text only. Held for the merchant's approval before anyone else sees it. */
@Entity('oss_review')
export class OssReview {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Index() @Column({ type: 'varchar', length: 60 }) productId!: string;
  @Column({ type: 'int' }) rating!: number;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 2000 }) body!: string;
  @Column({ type: 'varchar', length: 80 }) authorName!: string;
  /** Kept to check a purchase and to find the review again if its author asks to be erased. Never shown to other shoppers. */
  @Index() @Column({ type: 'varchar', length: 200 }) email!: string;
  @Column({ type: 'boolean', default: false }) verified!: boolean;
  @Column({ type: 'varchar', length: 10, default: 'pending' }) status!: ReviewStatus;
  @Column({ type: 'varchar', length: 1000, nullable: true }) reply!: string | null;
  @CreateDateColumn() at!: Date;
}

export const reviewShopExtensions = gql`
  input ReviewInput { productId: ID! rating: Int! title: String! body: String! name: String! email: String! }
  type PublicReview { id: Int! rating: Int! title: String! body: String! authorName: String! verified: Boolean! reply: String at: DateTime! }
  type ReviewSummary { count: Int! average: Float! }
  type ProductReviews { summary: ReviewSummary! items: [PublicReview!]! hasMore: Boolean! }
  extend type Query { productReviews(productId: ID!, take: Int, skip: Int): ProductReviews! }
  extend type Mutation { submitReview(input: ReviewInput!): Boolean! }
`;
export const reviewAdminExtensions = gql`
  type ReviewRow { id: Int! productId: ID! productName: String! rating: Int! title: String! body: String! authorName: String! email: String! verified: Boolean! status: String! reply: String at: DateTime! }
  type ReviewPage { items: [ReviewRow!]! total: Int! pending: Int! }
  extend type Query { reviews(status: String, take: Int, skip: Int): ReviewPage! }
  extend type Mutation { moderateReview(id: Int!, status: String!): Boolean! replyToReview(id: Int!, reply: String): Boolean! deleteReview(id: Int!): Boolean! }
`;
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e\\u2028\\u2029\\ufeff]', 'g');
const clean = (s: string, max: number) => String(s ?? '').replace(CONTROL, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const EMAIL = /^\S+@\S+\.\S+$/; const SETTLED = ['PaymentSettled', 'PartiallyShipped', 'Shipped', 'PartiallyDelivered', 'Delivered'];

@Injectable()
export class ReviewService {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(ActivityService) private activity: ActivityService) {}
  private repo() { return this.conn.rawConnection.getRepository(OssReview); }
  private row(ctx: RequestContext, id: number) { return this.repo().findOne({ where: { id, channelId: String(ctx.channelId) } }); }

  async submit(ctx: RequestContext, i: { productId: string; rating: number; title: string; body: string; name: string; email: string }) {
    const email = clean(i.email, 200).toLowerCase(); const title = clean(i.title, 120); const body = clean(i.body, 2000); const name = clean(i.name, 80);
    if (!Number.isInteger(i.rating) || i.rating < 1 || i.rating > 5) throw new UserInputError('Choose a rating from 1 to 5 stars.');
    if (!EMAIL.test(email)) throw new UserInputError('Enter a valid email address.'); if (!name) throw new UserInputError('Enter your name.'); if (!title) throw new UserInputError('Give your review a short title.'); if (body.length < 10) throw new UserInputError('Write a little more about the product (at least 10 characters).');
    const product = await this.conn.getRepository(ctx, Product).createQueryBuilder('p').innerJoin('p.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).where('p.id = :id AND p.enabled = :on AND p.deletedAt IS NULL', { id: i.productId, on: true }).getOne();
    if (!product) throw new UserInputError('That product was not found.');
    const productId = String(product.id); const mine = await this.repo().findOne({ where: { channelId: String(ctx.channelId), productId, email } });
    if (mine) throw new UserInputError('You have already reviewed this product. Thank you.');
    const bought = await this.conn.getRepository(ctx, OrderLine).createQueryBuilder('l').innerJoin('l.order', 'o').innerJoin('o.customer', 'c').innerJoin('o.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).innerJoin('l.productVariant', 'v')
      .where('LOWER(c.emailAddress) = :email AND v.productId = :pid AND o.state IN (:...s)', { email, pid: product.id, s: SETTLED }).getCount();
    await this.repo().save(this.repo().create({ channelId: String(ctx.channelId), productId, rating: i.rating, title, body, authorName: name, email, verified: bought > 0, status: 'pending', reply: null }));
    return true;
  }
  /** Only approved reviews, and never the author's email. */
  async forProduct(ctx: RequestContext, productId: string, take = 10, skip = 0) {
    const where = { channelId: String(ctx.channelId), productId: String(productId), status: 'approved' as const };
    const t = Math.min(Math.max(take, 1), 50); const [items, count] = await this.repo().findAndCount({ where, order: { id: 'DESC' }, take: t, skip: Math.max(skip, 0) });
    const all = await this.repo().find({ where, select: ['rating'] }); const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
    return { summary: { count: all.length, average: Math.round(avg * 10) / 10 }, items: items.map(r => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, authorName: r.authorName, verified: r.verified, reply: r.reply, at: r.at })), hasMore: skip + items.length < count };
  }
  async list(ctx: RequestContext, status?: string, take = 30, skip = 0) {
    const channelId = String(ctx.channelId); const where = { channelId, ...(status && ['pending', 'approved', 'rejected'].includes(status) ? { status: status as ReviewStatus } : {}) };
    const [rows, total] = await this.repo().findAndCount({ where, order: { id: 'DESC' }, take: Math.min(Math.max(take, 1), 100), skip: Math.max(skip, 0) });
    const names = new Map<string, string>(); for (const id of new Set(rows.map(r => r.productId))) { const p = await this.conn.getRepository(ctx, Product).findOne({ where: { id }, relations: ['translations'] }); names.set(id, p?.translations?.[0]?.name ?? 'A removed product'); }
    return { items: rows.map(r => ({ ...r, productName: names.get(r.productId) })), total, pending: await this.repo().count({ where: { channelId, status: 'pending' } }) };
  }
  async moderate(ctx: RequestContext, id: number, status: string) {
    if (!['pending', 'approved', 'rejected'].includes(status)) throw new UserInputError('Choose approve or reject.');
    const r = await this.row(ctx, id); if (!r) throw new UserInputError('That review was not found.'); r.status = status as ReviewStatus; await this.repo().save(r);
    await this.activity.record(ctx, { action: `review.${status}`, summary: `${{ approved: 'Approved', rejected: 'Rejected', pending: 'Returned to pending' }[status]} a ${r.rating}-star review from ${r.authorName}`, subjectType: 'review', subjectId: r.id }); return true;
  }
  async reply(ctx: RequestContext, id: number, reply?: string | null) {
    const r = await this.row(ctx, id); if (!r) throw new UserInputError('That review was not found.'); const t = clean(reply ?? '', 1000); r.reply = t || null; await this.repo().save(r);
    await this.activity.record(ctx, { action: 'review.reply', summary: `${t ? 'Replied to' : 'Removed the reply to'} ${r.authorName}'s review`, subjectType: 'review', subjectId: r.id }); return true;
  }
  async remove(ctx: RequestContext, id: number) { const r = await this.row(ctx, id); if (!r) throw new UserInputError('That review was not found.'); await this.repo().delete(r.id); await this.activity.record(ctx, { action: 'review.deleted', summary: `Deleted a review from ${r.authorName}`, subjectType: 'review', subjectId: r.id }); return true; }
  /** For a customer's erasure request: their reviews go too. */
  async eraseByEmail(ctx: RequestContext, email: string) { await this.repo().delete({ channelId: String(ctx.channelId), email: email.toLowerCase() }); }
}

@Resolver()
export class ReviewShopResolver {
  constructor(@Inject(ReviewService) private s: ReviewService) {}
  @Query() @Allow(Permission.Public) productReviews(@Ctx() ctx: RequestContext, @Args() a: { productId: string; take?: number; skip?: number }) { return this.s.forProduct(ctx, a.productId, a.take ?? 10, a.skip ?? 0); }
  @Transaction() @Mutation() @Allow(Permission.Public) submitReview(@Ctx() ctx: RequestContext, @Args() a: { input: { productId: string; rating: number; title: string; body: string; name: string; email: string } }) { return this.s.submit(ctx, a.input); }
}
@Resolver()
export class ReviewAdminResolver {
  constructor(@Inject(ReviewService) private s: ReviewService) {}
  @Query() @Allow(Permission.ReadCatalog) reviews(@Ctx() ctx: RequestContext, @Args() a: { status?: string; take?: number; skip?: number }) { return this.s.list(ctx, a.status, a.take ?? 30, a.skip ?? 0); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCatalog) moderateReview(@Ctx() ctx: RequestContext, @Args() a: { id: number; status: string }) { return this.s.moderate(ctx, a.id, a.status); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCatalog) replyToReview(@Ctx() ctx: RequestContext, @Args() a: { id: number; reply?: string }) { return this.s.reply(ctx, a.id, a.reply); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCatalog) deleteReview(@Ctx() ctx: RequestContext, @Args() a: { id: number }) { return this.s.remove(ctx, a.id); }
}
