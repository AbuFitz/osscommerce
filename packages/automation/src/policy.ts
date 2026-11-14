/** Pure scheduling policy: retry backoff, quiet hours, idempotency keys. No I/O, so it is trivial to test exhaustively. */
import { createHash } from 'node:crypto';

/** Delay before attempt n+1 after attempt n failed transiently. Returns null when attempts are exhausted. */
export const RETRY_SECONDS = [60, 300, 1800, 7200, 21600] as const;          // 1m, 5m, 30m, 2h, 6h
export const MAX_ATTEMPTS = RETRY_SECONDS.length + 1;                         // first try plus five retries
export function nextRetryDelaySeconds(attemptsMade: number, jitter = 0, schedule: readonly number[] = RETRY_SECONDS): number | null {
  const base = schedule[attemptsMade - 1]; if (base === undefined) return null;
  return Math.max(1, Math.round(base * (1 + jitter)));                        // jitter in [-0.2, 0.2], supplied by the caller
}

/** One run per (store, rule, event, recipient). Redelivery of the same event can never send twice. */
export const idempotencyKey = (storeId: string, ruleId: string, eventId: string, recipient: string) =>
  createHash('sha256').update([storeId, ruleId, eventId, recipient.toLowerCase()].join('\u0000')).digest('hex').slice(0, 40);

const hourIn = (d: Date, tz: string) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(d)) % 24;
/** Marketing is not sent overnight in the merchant's time zone. `from` > `to` means the window wraps midnight (e.g. 21 to 8). */
export function deferOutOfQuietHours(at: Date, q: { tz: string; from: number; to: number } | null): Date {
  if (!q) return at;
  const quiet = (h: number) => (q.from > q.to ? h >= q.from || h < q.to : h >= q.from && h < q.to);
  let t = new Date(at.getTime());
  for (let i = 0; i < 24 * 4 && quiet(hourIn(t, q.tz)); i++) t = new Date(t.getTime() + 15 * 60_000);
  return t;
}
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Dot-path lookup and predicate evaluation for rule conditions. */
export function getPath(obj: unknown, path: string): unknown { return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj); }
export function matches(event: unknown, c: { path: string; op: 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'exists'; value?: unknown }): boolean {
  const v = getPath(event, c.path);
  switch (c.op) {
    case 'exists': return v !== undefined && v !== null;
    case 'eq': return v === c.value; case 'neq': return v !== c.value;
    case 'gte': return typeof v === 'number' && typeof c.value === 'number' && v >= c.value;
    case 'lte': return typeof v === 'number' && typeof c.value === 'number' && v <= c.value;
    case 'in': return Array.isArray(c.value) && c.value.includes(v);
  }
}
