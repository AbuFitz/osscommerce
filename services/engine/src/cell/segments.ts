import gql from 'graphql-tag';
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Allow, Ctx, Permission, RequestContext, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';
import { MAX_SEGMENTS, validateSegment } from '@oss-commerce/contracts';
import { ActivityService } from './activity.ts';

/** A merchant's saved customer segment. Only the rules are stored; who is in it is worked out from orders each time. */
@Entity('oss_segment')
export class OssSegment {
  @PrimaryGeneratedColumn() id!: number;
  @Index() @Column({ type: 'varchar', length: 60 }) channelId!: string;
  @Column({ type: 'varchar', length: 80 }) name!: string;
  @Column({ type: 'text' }) definition!: string;
}
export const segmentApiExtensions = gql`
  type CustomerSegment { id: Int! name: String! definition: String! }
  extend type Query { customerSegments: [CustomerSegment!]! }
  extend type Mutation { saveCustomerSegment(id: Int, name: String!, definition: String!): CustomerSegment! deleteCustomerSegment(id: Int!): Boolean! }
`;

@Injectable()
export class SegmentService {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(ActivityService) private activity: ActivityService) {}
  private repo() { return this.conn.rawConnection.getRepository(OssSegment); }
  list(ctx: RequestContext) { return this.repo().find({ where: { channelId: String(ctx.channelId) }, order: { id: 'ASC' } }); }
  async save(ctx: RequestContext, a: { id?: number; name: string; definition: string }) {
    let def: unknown; try { def = JSON.parse(a.definition); } catch { throw new UserInputError('The segment rules are not valid.'); }
    const bad = validateSegment(a.name, def); if (bad) throw new UserInputError(bad);
    const channelId = String(ctx.channelId); const name = a.name.trim(); const clean = JSON.stringify(def);
    if (a.id) {
      const row = await this.repo().findOne({ where: { id: a.id, channelId } }); if (!row) throw new UserInputError('That segment was not found.');   // another store's id is simply "not found"
      row.name = name; row.definition = clean; await this.repo().save(row); await this.activity.record(ctx, { action: 'segment.updated', summary: `Changed the segment ${name}`, subjectType: 'segment', subjectId: row.id }); return row;
    }
    if ((await this.repo().count({ where: { channelId } })) >= MAX_SEGMENTS) throw new UserInputError(`You can keep up to ${MAX_SEGMENTS} segments. Delete one you no longer use.`);
    const row = await this.repo().save(this.repo().create({ channelId, name, definition: clean })); await this.activity.record(ctx, { action: 'segment.created', summary: `Created the segment ${name}`, subjectType: 'segment', subjectId: row.id }); return row;
  }
  async remove(ctx: RequestContext, id: number) {
    const row = await this.repo().findOne({ where: { id, channelId: String(ctx.channelId) } }); if (!row) throw new UserInputError('That segment was not found.');
    await this.repo().delete(row.id); await this.activity.record(ctx, { action: 'segment.deleted', summary: `Deleted the segment ${row.name}`, subjectType: 'segment', subjectId: row.id }); return true;
  }
}
@Resolver()
export class SegmentResolver {
  constructor(@Inject(SegmentService) private s: SegmentService) {}
  @Query() @Allow(Permission.ReadCustomer) customerSegments(@Ctx() ctx: RequestContext) { return this.s.list(ctx); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCustomer) saveCustomerSegment(@Ctx() ctx: RequestContext, @Args() a: { id?: number; name: string; definition: string }) { return this.s.save(ctx, a); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCustomer) deleteCustomerSegment(@Ctx() ctx: RequestContext, @Args() a: { id: number }) { return this.s.remove(ctx, a.id); }
}
