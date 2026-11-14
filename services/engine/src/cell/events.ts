import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EventBus, OrderStateTransitionEvent, TransactionalConnection, Order, RequestContext } from '@vendure/core';
import { fromOrderState, flush, type DispatcherDeps } from './outbox.ts';
import { TypeOrmOutbox } from './outbox-entity.ts';
import { CellPlugin } from './plugin.ts';

/** Records buyer/merchant-relevant order transitions to the outbox, delivers them, and sweeps for any transition whose event was lost
 *  (a crash between the order commit and the subscriber). The sweep makes delivery at-least-once without needing a distributed transaction. */
@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout; private store!: TypeOrmOutbox;
  constructor(@Inject(EventBus) private bus: EventBus, @Inject(TransactionalConnection) private conn: TransactionalConnection) {}
  onApplicationBootstrap() {
    this.store = new TypeOrmOutbox(this.conn, () => RequestContext.empty());
    this.bus.ofType(OrderStateTransitionEvent).subscribe(e => { void this.record(e.order.id, e.toState); });
    const o = CellPlugin.options.outbox; if (!o) return;
    this.timer = setInterval(() => { void this.tick(o).catch(() => {}); }, o.intervalMs ?? 5000); this.timer.unref();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  async record(orderId: string | number, toState: string) {
    const order = await this.conn.rawConnection.getRepository(Order).findOne({ where: { id: orderId as any }, relations: ['customer'] }); if (!order) return;
    const ev = fromOrderState(CellPlugin.options.storeId, { id: String(order.id), code: order.code, totalWithTax: order.totalWithTax, currencyCode: order.currencyCode, customer: order.customer }, toState, '1');
    if (ev) await this.store.add(ev);
  }
  /** Re-derive events for settled/shipped/cancelled orders that have none. Idempotent: the id is deterministic. */
  async sweep(sinceDays = 7) {
    const since = new Date(Date.now() - sinceDays * 86400_000);
    const orders = await this.conn.rawConnection.getRepository(Order).createQueryBuilder('o').where('o.state IN (:...s) AND o.updatedAt > :since', { s: ['PaymentSettled', 'Shipped', 'Cancelled'], since }).getMany();
    let added = 0; for (const o of orders) { const before = await this.store.has(`${CellPlugin.options.storeId}:${o.code}:${o.state}:1`); if (!before) { await this.record(o.id, o.state); added++; } } return added;
  }
  tick(o: NonNullable<typeof CellPlugin.options.outbox>) { const d: DispatcherDeps = { store: this.store, cellId: o.cellId, secret: o.secret, url: o.url, post: o.post, onAlert: o.onAlert }; return flush(d); }
  get outbox() { return this.store; }
}
