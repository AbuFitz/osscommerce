import type { Customer } from './gateway';

export type SegmentKey = 'all' | 'new' | 'returning' | 'top' | 'inactive';
export const SEGMENTS: { key: SegmentKey; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Everyone who has ordered' },
  { key: 'new', label: 'New', hint: 'First order in the last 30 days' },
  { key: 'returning', label: 'Returning', hint: 'Ordered more than once' },
  { key: 'top', label: 'Top spenders', hint: 'The top 10% by money spent' },
  { key: 'inactive', label: 'Not back in 60 days', hint: 'Last order over 60 days ago' },
];
const DAY = 86_400_000;
export const daysSince = (iso: string, now: Date) => (iso ? Math.floor((now.getTime() - Date.parse(iso)) / DAY) : Infinity);

/** Which segments each customer is in. Computed from their orders, so it is always current and needs no setup. */
export function segmentsOf(cs: Customer[], now = new Date()): Map<string, Set<SegmentKey>> {
  const spends = cs.map(c => c.spentMinor).sort((a, b) => a - b); const cut = cs.length >= 5 ? spends[Math.max(0, Math.ceil(spends.length * 0.9) - 1)] : Infinity;
  const out = new Map<string, Set<SegmentKey>>();
  for (const c of cs) {
    const s = new Set<SegmentKey>(['all']); const d = daysSince(c.lastOrder, now);
    if (c.orders === 1 && d <= 30) s.add('new'); if (c.orders >= 2) s.add('returning'); if (c.spentMinor >= cut && c.spentMinor > 0) s.add('top'); if (d > 60) s.add('inactive');
    out.set(c.id, s);
  }
  return out;
}
export const countBySegment = (m: Map<string, Set<SegmentKey>>): Record<SegmentKey, number> => { const r = { all: 0, new: 0, returning: 0, top: 0, inactive: 0 } as Record<SegmentKey, number>; for (const s of m.values()) for (const k of s) r[k]++; return r; };
export const matches = (c: Customer, q: string) => { const t = q.trim().toLowerCase(); return !t || `${c.name} ${c.email}`.toLowerCase().includes(t); };

/** CSV-safe text: a leading = + - @ would be run as a formula by a spreadsheet, so it is prefixed with a quote. */
export const csvText = (v: string) => { const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
