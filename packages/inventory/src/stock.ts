import { z } from 'zod';

/**
 * One product sold in several formats that draw on the same stock: a single, a pack of 6, a case of 24.
 * Merchants describe it once; availability for every format is derived, so nothing is counted twice and nothing drifts.
 *
 * Two ways of holding the stock, chosen per product:
 *  - pooled: everything is counted in single units. A pack is "virtual": it is available while there are enough singles, and selling one removes that many.
 *  - sealed: packs are physical. They sit on the shelf sealed and are counted separately. Selling singles uses loose singles first and, when
 *            they run out, breaks a sealed pack automatically (if autoBreak is on), moving its units into loose stock and telling the merchant.
 */
export const Format = z.object({ id: z.string().min(1), label: z.string().optional(), units: z.number().int().positive() });
export const Policy = z.object({
  mode: z.enum(['pooled', 'sealed']),
  /** sealed mode: break a pack for singles on demand instead of selling out of singles. */
  autoBreak: z.boolean().default(true),
  /** In units (singles). The alert fires when total units fall to this or below. */
  lowAtUnits: z.number().int().nonnegative().default(0),
});
export const Group = z.object({ id: z.string(), formats: z.array(Format).min(1), policy: Policy });
export type Format = z.infer<typeof Format>; export type Policy = z.infer<typeof Policy>; export type Group = z.infer<typeof Group>;

/** Stock on hand. `loose` is singles. `sealed` is the number of unopened packs per format id (never includes the single format). */
export interface State { loose: number; sealed: Record<string, number> }

export type StockEvent =
  | { type: 'stock.pack_broken'; formatId: string; packs: number; unitsReleased: number }
  | { type: 'stock.low'; unitsLeft: number }
  | { type: 'stock.out' };

const single = (g: Group) => g.formats.find(f => f.units === 1);
const packs = (g: Group) => g.formats.filter(f => f.units > 1);
const sealedOf = (s: State, id: string) => s.sealed[id] ?? 0;

/** Every unit in the building, whichever way it is held. */
export function totalUnits(g: Group, s: State): number {
  return s.loose + packs(g).reduce((n, f) => n + sealedOf(s, f.id) * f.units, 0);
}

/** How many of one format a shopper could buy right now. */
export function available(g: Group, s: State, formatId: string): number {
  const f = g.formats.find(x => x.id === formatId); if (!f) throw new Error(`Unknown format ${formatId}`);
  if (g.policy.mode === 'pooled') return Math.floor(totalUnits(g, s) / f.units);
  if (f.units === 1) return g.policy.autoBreak ? totalUnits(g, s) : s.loose;
  return sealedOf(s, f.id);
}
export const availability = (g: Group, s: State): Record<string, number> => Object.fromEntries(g.formats.map(f => [f.id, available(g, s, f.id)]));

export interface SaleResult { ok: boolean; state: State; events: StockEvent[]; reason?: 'unknown_format' | 'insufficient_stock' | 'bad_quantity' }

function after(g: Group, before: State, now: State, events: StockEvent[]) {
  const total = totalUnits(g, now);
  if (total === 0) events.push({ type: 'stock.out' });
  else if (total <= g.policy.lowAtUnits && total < totalUnits(g, before)) events.push({ type: 'stock.low', unitsLeft: total });
}

/** Sell `qty` of a format. Pure: returns the new state and the events to act on; the caller persists both. */
export function sell(g: Group, s: State, formatId: string, qty: number): SaleResult {
  const f = g.formats.find(x => x.id === formatId);
  if (!f) return { ok: false, state: s, events: [], reason: 'unknown_format' };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, state: s, events: [], reason: 'bad_quantity' };
  if (available(g, s, formatId) < qty) return { ok: false, state: s, events: [], reason: 'insufficient_stock' };
  const next: State = { loose: s.loose, sealed: { ...s.sealed } }; const events: StockEvent[] = [];
  if (g.policy.mode === 'pooled') {
    next.loose -= f.units * qty; // pooled stock is held entirely as singles
  } else if (f.units > 1) {
    next.sealed[f.id] = sealedOf(next, f.id) - qty;
  } else {
    // Singles: loose first, then open the smallest pack that has stock, until covered. Smallest first leaves the least stray stock.
    const broken = new Map<string, { packs: number; units: number }>();
    for (const p of [...packs(g)].sort((a, b) => a.units - b.units)) {
      while (next.loose < qty && sealedOf(next, p.id) > 0) {
        next.sealed[p.id] = sealedOf(next, p.id) - 1; next.loose += p.units;
        const b = broken.get(p.id) ?? { packs: 0, units: 0 }; b.packs++; b.units += p.units; broken.set(p.id, b);
      }
    }
    next.loose -= qty;
    for (const [formatId2, b] of broken) events.push({ type: 'stock.pack_broken', formatId: formatId2, packs: b.packs, unitsReleased: b.units });
  }
  after(g, s, next, events);
  return { ok: true, state: next, events };
}

/** Add stock. `formatId` is what arrived: singles go to loose, packs to sealed (pooled stock is always counted in singles). */
export function restock(g: Group, s: State, formatId: string, qty: number): State {
  const f = g.formats.find(x => x.id === formatId); if (!f) throw new Error(`Unknown format ${formatId}`);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive whole number.');
  if (g.policy.mode === 'pooled') return { loose: s.loose + f.units * qty, sealed: { ...s.sealed } };
  return f.units === 1 ? { loose: s.loose + qty, sealed: { ...s.sealed } } : { loose: s.loose, sealed: { ...s.sealed, [f.id]: sealedOf(s, f.id) + qty } };
}

/** Configuration mistakes worth refusing before they cost a sale. */
export function validate(g: Group): string[] {
  const out: string[] = []; const ids = g.formats.map(f => f.id);
  if (new Set(ids).size !== ids.length) out.push('Format ids must be unique.');
  if (!single(g)) out.push('Include a single (1 unit) format so stock has a base unit.');
  if (new Set(g.formats.map(f => f.units)).size !== g.formats.length) out.push('Two formats cannot hold the same number of units.');
  return out;
}
