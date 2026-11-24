import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Logger, LanguageCode, PluginCommonModule, ProductVariant, StockLevelService, StockMovementEvent, StockMovementService, TransactionalConnection, VendurePlugin, type RequestContext } from '@vendure/core';

/**
 * Packs and singles. A single-unit variant can name the pack variant it is refilled from. When the singles run low, the plugin opens as many packs as
 * needed: the pack count goes down, the single count goes up by the pack size, and both changes appear in each variant's stock history.
 * The merchant sets three things on the single variant: which pack (by SKU), how many units it holds, and the level at or below which to open one.
 */
export const PACK_FIELDS = { source: 'packSourceSku', units: 'packUnits', openAt: 'packOpenAt' } as const;

/** How many packs to open. Pure so it can be tested without an engine. */
export function packsToOpen(a: { singleSaleable: number; packSaleable: number; unitsPerPack: number; openAt: number }): number {
  if (!Number.isInteger(a.unitsPerPack) || a.unitsPerPack < 1 || a.packSaleable <= 0 || a.singleSaleable > a.openAt) return 0;
  const need = a.openAt - a.singleSaleable + 1;       // enough to climb back above the level
  return Math.min(a.packSaleable, Math.ceil(need / a.unitsPerPack));
}

@Injectable()
export class PackRefillService implements OnApplicationBootstrap {
  private chain = new Map<string, Promise<void>>();
  constructor(@Inject(EventBus) private bus: EventBus, @Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(StockLevelService) private levels: StockLevelService, @Inject(StockMovementService) private moves: StockMovementService) {}
  onApplicationBootstrap() {
    this.bus.ofType(StockMovementEvent).subscribe(e => {
        const ids = new Set(e.stockMovements.map(m => String((m as any).productVariant?.id ?? '')).filter(Boolean));
      for (const id of ids) this.enqueue(e.ctx, id);
    });
  }
  /** One variant at a time within this process; the database row locks cover the rest. */
  private enqueue(ctx: RequestContext, singleId: string) {
    const run = (this.chain.get(singleId) ?? Promise.resolve()).then(async () => { await this.refill(ctx, singleId); }).catch(err => Logger.error(`Pack refill failed for variant ${singleId}: ${err instanceof Error ? err.message : err}`, 'PackRefill'));
    this.chain.set(singleId, run); run.finally(() => { if (this.chain.get(singleId) === run) this.chain.delete(singleId); });
  }
  async refill(ctx: RequestContext, singleId: string): Promise<number> {
    const v = await this.conn.getRepository(ctx, ProductVariant).findOne({ where: { id: singleId } });
    const f = (v?.customFields ?? {}) as Record<string, unknown>; const packSku = f[PACK_FIELDS.source]; const units = Number(f[PACK_FIELDS.units]); const openAt = Number(f[PACK_FIELDS.openAt] ?? 0);
    if (!v || typeof packSku !== 'string' || !packSku || !Number.isInteger(units) || units < 1) return 0;
    // The pack must belong to this store's own channel. A link to anyone else's variant is ignored (it is looked up by SKU inside this channel only).
    const pack = await this.conn.getRepository(ctx, ProductVariant).createQueryBuilder('v').innerJoin('v.channels', 'ch').where('v.sku = :sku', { sku: packSku }).andWhere('v.deletedAt IS NULL').andWhere('ch.id = :cid', { cid: ctx.channelId }).getOne();
    if (!pack || String(pack.id) === String(v.id)) return 0;
    let opened = 0;
    await this.conn.withTransaction(ctx, async tctx => {
      await this.levels.lockStockLevelsForVariants(tctx, [v.id, pack.id], { includeUntrackedVariants: true });
      const s = await this.levels.getAvailableStock(tctx, v.id); const p = await this.levels.getAvailableStock(tctx, pack.id);
      const k = packsToOpen({ singleSaleable: s.stockOnHand - s.stockAllocated, packSaleable: p.stockOnHand - p.stockAllocated, unitsPerPack: units, openAt: Number.isFinite(openAt) ? openAt : 0 });
      if (!k) return;
      await this.moves.adjustProductVariantStock(tctx, pack.id, p.stockOnHand - k);
      await this.moves.adjustProductVariantStock(tctx, v.id, s.stockOnHand + k * units);
      opened = k;
    });
    if (opened) Logger.info(`Opened ${opened} pack(s) of ${units} for variant ${singleId}`, 'PackRefill');
    return opened;
  }
}

@VendurePlugin({
  imports: [PluginCommonModule], providers: [PackRefillService],
  configuration: config => {
    const t = (en: string) => [{ languageCode: LanguageCode.en, value: en }];
    config.customFields.ProductVariant = [...(config.customFields.ProductVariant ?? []),
      { name: PACK_FIELDS.source, type: 'string', nullable: true, public: false, label: t('Refilled from (pack SKU)'), description: t('The pack this single is opened from when it runs low.') },
      { name: PACK_FIELDS.units, type: 'int', nullable: true, min: 1, public: false, label: t('Units in the pack') },
      { name: PACK_FIELDS.openAt, type: 'int', nullable: true, min: 0, defaultValue: 0, public: false, label: t('Open a pack at or below'), description: t('Open a pack when saleable singles fall to this level.') }];
    return config;
  },
})
export class PackRefillPlugin {}
