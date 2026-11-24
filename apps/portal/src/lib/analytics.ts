import type { Order } from './gateway';

/**
 * Everything on the Analytics page is computed here from the store's orders, so the numbers always agree with the Orders page.
 * Dates are calendar days in Europe/London. A refund is counted on the day of the order it belongs to (the order history does not carry refund dates).
 */
export const TZ = 'Europe/London';
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const ymd = (d: Date | string) => ymdFmt.format(typeof d === 'string' ? new Date(d) : d);
const addDays = (k: string, n: number) => { const d = new Date(`${k}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

export const PRESETS = [['7d', 'Last 7 days', 7], ['14d', 'Last 14 days', 14], ['30d', 'Last 30 days', 30], ['90d', 'Last 90 days', 90]] as const;
export type MetricKey = 'net' | 'gross' | 'orders' | 'aov' | 'units' | 'refunds';
export const METRICS: { key: MetricKey; label: string; money: boolean }[] = [
  { key: 'net', label: 'Net sales', money: true }, { key: 'gross', label: 'Sales before refunds', money: true }, { key: 'orders', label: 'Orders', money: false },
  { key: 'aov', label: 'Average order', money: true }, { key: 'units', label: 'Items sold', money: false }, { key: 'refunds', label: 'Refunds', money: true }];

export const isSale = (o: Order) => o.payment === 'paid' || o.payment === 'partially_refunded' || o.payment === 'refunded' || o.payment === 'disputed';

export interface Day { day: string; gross: number; refunds: number; net: number; orders: number; units: number; aov: number }
export interface Totals { gross: number; refunds: number; net: number; orders: number; units: number; aov: number; customers: number }
export interface Report {
  from: string; to: string; days: number; prevFrom: string; prevTo: string;
  series: Day[]; prev: Day[]; totals: Totals; prevTotals: Totals;
  topProducts: { title: string; units: number; gross: number }[];
  weekday: { label: string; gross: number; orders: number }[];
  customers: { new: number; returning: number; newGross: number; returningGross: number };
  methods: { label: string; orders: number; gross: number }[];
  discounts: { orders: number; amount: number };
  status: { label: string; count: number }[];
  hasData: boolean;
}

/** Resolve a range from query values. Unknown or malformed input falls back to the last 30 days. */
export function resolveRange(q: { range?: string; from?: string; to?: string }, today: string): { from: string; to: string; label: string } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (q.from && q.to && re.test(q.from) && re.test(q.to) && q.from <= q.to && daysBetween(q.from, q.to) < 400) return { from: q.from, to: q.to > today ? today : q.to, label: 'Custom range' };
  const p = PRESETS.find(x => x[0] === q.range) ?? PRESETS[2];
  return { from: addDays(today, -(p[2] - 1)), to: today, label: p[1] };
}

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const wdIndex = (k: string) => (new Date(`${k}T12:00:00Z`).getUTCDay() + 6) % 7;
const methodLabel = (o: Order) => o.method ? (o.method.wallet ? { applepay: 'Apple Pay', googlepay: 'Google Pay', link: 'Link' }[o.method.wallet] : { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' }[o.method.brand]) : 'Other';

function daily(orders: Order[], from: string, n: number): Day[] {
  const by = new Map<string, Order[]>(); for (const o of orders) { const k = ymd(o.placedAt); (by.get(k) ?? by.set(k, []).get(k)!).push(o); }
  return Array.from({ length: n }, (_, i) => {
    const k = addDays(from, i); const os = by.get(k) ?? [];
    const gross = os.reduce((s, o) => s + o.totalMinor, 0), refunds = os.reduce((s, o) => s + o.refundedMinor, 0), units = os.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
    return { day: k, gross, refunds, net: gross - refunds, orders: os.length, units, aov: os.length ? Math.round(gross / os.length) : 0 };
  });
}
function totalsOf(orders: Order[]): Totals {
  const gross = orders.reduce((s, o) => s + o.totalMinor, 0), refunds = orders.reduce((s, o) => s + o.refundedMinor, 0);
  return { gross, refunds, net: gross - refunds, orders: orders.length, units: orders.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0), aov: orders.length ? Math.round(gross / orders.length) : 0, customers: new Set(orders.map(o => o.email.toLowerCase())).size };
}

export function buildReport(all: Order[], range: { from: string; to: string }): Report {
  const days = daysBetween(range.from, range.to) + 1; const prevTo = addDays(range.from, -1); const prevFrom = addDays(range.from, -days);
  const sales = all.filter(isSale); const within = (o: Order, a: string, b: string) => { const k = ymd(o.placedAt); return k >= a && k <= b; };
  const cur = sales.filter(o => within(o, range.from, range.to)); const prv = sales.filter(o => within(o, prevFrom, prevTo));
  const firstSeen = new Map<string, string>(); for (const o of [...sales].sort((a, b) => a.placedAt.localeCompare(b.placedAt))) { const e = o.email.toLowerCase(); if (!firstSeen.has(e)) firstSeen.set(e, o.id); }
  const isNew = (o: Order) => firstSeen.get(o.email.toLowerCase()) === o.id;
  const prod = new Map<string, { units: number; gross: number }>(); for (const o of cur) for (const l of o.lines) { const p = prod.get(l.title) ?? { units: 0, gross: 0 }; p.units += l.qty; p.gross += l.qty * l.unitMinor; prod.set(l.title, p); }
  const wd = WD.map(label => ({ label, gross: 0, orders: 0 })); for (const o of cur) { const w = wd[wdIndex(ymd(o.placedAt))]; w.gross += o.totalMinor; w.orders++; }
  const meth = new Map<string, { orders: number; gross: number }>(); for (const o of cur) { const l = methodLabel(o) ?? 'Other'; const m = meth.get(l) ?? { orders: 0, gross: 0 }; m.orders++; m.gross += o.totalMinor; meth.set(l, m); }
  const inRange = all.filter(o => within(o, range.from, range.to));
  const newOs = cur.filter(isNew), retOs = cur.filter(o => !isNew(o)); const disc = cur.filter(o => o.discountMinor > 0);
  return {
    ...range, days, prevFrom, prevTo, series: daily(cur, range.from, days), prev: daily(prv, prevFrom, days), totals: totalsOf(cur), prevTotals: totalsOf(prv),
    topProducts: [...prod].map(([title, v]) => ({ title, ...v })).sort((a, b) => b.gross - a.gross).slice(0, 8),
    weekday: wd, customers: { new: newOs.length, returning: retOs.length, newGross: newOs.reduce((s, o) => s + o.totalMinor, 0), returningGross: retOs.reduce((s, o) => s + o.totalMinor, 0) },
    methods: [...meth].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.gross - a.gross),
    discounts: { orders: disc.length, amount: disc.reduce((s, o) => s + o.discountMinor, 0) },
    status: [{ label: 'Fulfilled', count: inRange.filter(o => o.state === 'completed').length }, { label: 'To fulfil', count: inRange.filter(o => o.state === 'open').length }, { label: 'Cancelled', count: inRange.filter(o => o.state === 'cancelled').length }],
    hasData: cur.length > 0,
  };
}

/** Percentage change, or null when there is nothing to compare with. */
export const change = (now: number, before: number): number | null => (before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100);
export const metricOf = (d: Day, k: MetricKey): number => (k === 'net' ? d.net : k === 'gross' ? d.gross : k === 'orders' ? d.orders : k === 'aov' ? d.aov : k === 'units' ? d.units : d.refunds);
export const totalOf = (t: Totals, k: MetricKey): number => (k === 'net' ? t.net : k === 'gross' ? t.gross : k === 'orders' ? t.orders : k === 'aov' ? t.aov : k === 'units' ? t.units : t.refunds);

/** CSV of the daily series, safe against spreadsheet formula injection (values are numbers and ISO dates only). */
export function toCsv(r: Report): string {
  const rows = [['Date', 'Sales before refunds (GBP)', 'Refunds (GBP)', 'Net sales (GBP)', 'Orders', 'Items sold', 'Average order (GBP)'], ...r.series.map(d => [d.day, (d.gross / 100).toFixed(2), (d.refunds / 100).toFixed(2), (d.net / 100).toFixed(2), String(d.orders), String(d.units), (d.aov / 100).toFixed(2)])];
  return rows.map(c => c.join(',')).join('\n') + '\n';
}
