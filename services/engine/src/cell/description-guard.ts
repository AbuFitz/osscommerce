import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, ProductEvent, ProductTranslation, TransactionalConnection } from '@vendure/core';
import { toRichText } from '@oss-commerce/contracts';

/**
 * Whatever wrote a product description (the portal, a script, a stolen session), it is cleaned to the safe subset before a storefront can read it.
 * Runs after every product save and rewrites only a description that is not already clean, so it settles after one pass.
 */
@Injectable()
export class DescriptionGuard implements OnApplicationBootstrap {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(EventBus) private bus: EventBus) {}
  onApplicationBootstrap() { this.bus.ofType(ProductEvent).subscribe(e => { if (e.type !== 'deleted') void this.clean(e.entity.id).catch(() => {}); }); }
  async clean(productId: unknown) {
    const repo = this.conn.rawConnection.getRepository(ProductTranslation);
    for (const t of await repo.find({ where: { base: { id: productId } } as never })) { const safe = toRichText(t.description ?? ''); if (safe !== (t.description ?? '')) await repo.update(t.id, { description: safe }); }
  }
}
