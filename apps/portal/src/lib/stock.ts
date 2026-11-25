/** The rules for stock, kept in one place so the engine adapter, the demo and the screens agree. */
export const REASONS = [['recount', 'Stock count'], ['received', 'Delivery received'], ['damaged', 'Damaged or lost'], ['returned', 'Customer return'], ['other', 'Other']] as const;
export type Reason = (typeof REASONS)[number][0];
export const reasonLabel = (r: string) => REASONS.find(x => x[0] === r)?.[1] ?? r;
export const MAX_UNITS = 1_000_000;
export const DEFAULT_LOW_AT = 5;

export type StockStatus = 'ok' | 'low' | 'out' | 'backorder' | 'untracked';
export function stockStatus(r: { onHand: number; allocated: number; lowAt: number; tracked: boolean; backorder: boolean }): StockStatus {
  if (!r.tracked) return 'untracked'; const avail = r.onHand - r.allocated;
  if (avail <= 0) return r.backorder ? 'backorder' : 'out'; return avail <= r.lowAt ? 'low' : 'ok';
}

/** The result of asking for a new stock level. `error` says why not, in plain words. */
export function planAdjust(cur: { onHand: number; allocated: number }, a: { mode: 'set' | 'add'; qty: number }): { ok: true; to: number; delta: number } | { ok: false; error: string } {
  if (!Number.isInteger(a.qty)) return { ok: false, error: 'Enter a whole number.' };
  const to = a.mode === 'set' ? a.qty : cur.onHand + a.qty;
  if (to < 0) return { ok: false, error: `That would take stock below zero (you have ${cur.onHand}).` };
  if (to > MAX_UNITS) return { ok: false, error: 'That is more than the shop can track.' };
  if (to < cur.allocated) return { ok: false, error: `${cur.allocated} ${cur.allocated === 1 ? 'is' : 'are'} reserved for open orders, so stock cannot go below ${cur.allocated}. Fulfil or cancel those orders first.` };
  return { ok: true, to, delta: to - cur.onHand };
}

export interface CountLine { variantId: string; counted: number }
export interface CountRow { variantId: string; onHand: number; allocated: number }
export interface CountPlan { changes: { variantId: string; from: number; to: number }[]; unchanged: number; problems: { variantId: string; error: string }[] }
/** Turns what was counted on the shelf into changes. Lines that match what the system holds change nothing; impossible counts are reported, not applied. */
export function planCount(rows: CountRow[], lines: CountLine[]): CountPlan {
  const by = new Map(rows.map(r => [r.variantId, r])); const plan: CountPlan = { changes: [], unchanged: 0, problems: [] }; const seen = new Set<string>();
  for (const l of lines) {
    const r = by.get(l.variantId); if (!r) { plan.problems.push({ variantId: l.variantId, error: 'This item is not in your catalogue.' }); continue; }
    if (seen.has(l.variantId)) { plan.problems.push({ variantId: l.variantId, error: 'Counted twice.' }); continue; } seen.add(l.variantId);
    const p = planAdjust(r, { mode: 'set', qty: l.counted }); if (!p.ok) { plan.problems.push({ variantId: l.variantId, error: p.error }); continue; }
    if (p.delta === 0) plan.unchanged++; else plan.changes.push({ variantId: l.variantId, from: r.onHand, to: p.to });
  }
  return plan;
}

export interface LogEntry { at: string; from: number; to: number; reason: string; by?: string; note?: string }
const LOG_MAX = 50, LOG_BYTES = 12_000;
export const parseLog = (raw: string | null | undefined): LogEntry[] => { try { const a = JSON.parse(raw ?? '[]'); return Array.isArray(a) ? a.filter((e): e is LogEntry => e && typeof e.at === 'string' && Number.isFinite(e.from) && Number.isFinite(e.to)) : []; } catch { return []; } };
/** Adds an entry to the stored history, keeping the newest and a bounded size. */
export function appendLog(raw: string | null | undefined, e: LogEntry): string {
  const list = [...parseLog(raw), { ...e, note: e.note?.slice(0, 200), by: e.by?.slice(0, 60) }].slice(-LOG_MAX); let s = JSON.stringify(list);
  while (s.length > LOG_BYTES && list.length > 1) { list.shift(); s = JSON.stringify(list); } return s;
}
