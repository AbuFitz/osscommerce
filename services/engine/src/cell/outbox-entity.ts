import { Entity, PrimaryColumn, Column, Index } from 'typeorm';
import { TransactionalConnection, RequestContext } from '@vendure/core';
import type { OutboxEvent, OutboxRow, OutboxStore } from './outbox.ts';

/** The cell's own outbox table. Lives in the merchant's database next to the orders it describes. */
@Entity('oss_outbox')
export class OssOutbox {
  @PrimaryColumn({ type: 'varchar', length: 190 }) id!: string;
  @Column({ type: 'text' }) payload!: string;
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @Index() @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) } }) nextAt!: number;
  @Column({ type: 'bigint', nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | number | null) => (v == null ? null : Number(v)) } }) deliveredAt!: number | null;
}

export class TypeOrmOutbox implements OutboxStore {
  constructor(private conn: TransactionalConnection, private ctx: () => RequestContext) {}
  private repo() { return this.conn.rawConnection.getRepository(OssOutbox); }
  async add(e: OutboxEvent) { await this.repo().createQueryBuilder().insert().values({ id: e.id, payload: JSON.stringify(e), attempts: 0, nextAt: 0, deliveredAt: null }).orIgnore().execute(); }
  async due(now: number, limit: number): Promise<OutboxRow[]> {
    const rows = await this.repo().createQueryBuilder('o').where('o.deliveredAt IS NULL AND o.nextAt <= :now', { now }).orderBy('o.nextAt', 'ASC').take(limit).getMany();
    return rows.map(r => ({ event: JSON.parse(r.payload) as OutboxEvent, attempts: r.attempts, nextAt: r.nextAt }));
  }
  async markDelivered(ids: string[], now: number) { if (ids.length) await this.repo().createQueryBuilder().update().set({ deliveredAt: now }).whereInIds(ids).execute(); }
  async markFailed(ids: string[], nextAt: number) { if (ids.length) await this.repo().createQueryBuilder().update().set({ nextAt, attempts: () => 'attempts + 1' }).whereInIds(ids).execute(); }
  async has(id: string) { return (await this.repo().count({ where: { id } })) > 0; }
}
