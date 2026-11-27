/**
 * Saved customer segments: a name and a few simple rules, worked out from each customer's orders whenever they are looked at, so a segment is never out of date.
 * One definition of what a valid segment is, shared by the portal (to explain a mistake) and the engine (to refuse one).
 */
export type SegmentField = 'orders' | 'spent' | 'daysSinceOrder' | 'marketing';
export type SegmentOp = 'gte' | 'lte' | 'eq';
export interface SegmentRule { field: SegmentField; op: SegmentOp; /** Whole number of orders or days; pounds for `spent`; 1 or 0 for `marketing`. */ value: number }
export interface SegmentDefinition { match: 'all' | 'any'; rules: SegmentRule[] }
export interface SegmentCustomer { orders: number; spentMinor: number; /** ISO time of the last order, or empty. */ lastOrder: string; marketing: boolean }

export const SEGMENT_FIELDS: Record<SegmentField, { label: string; unit: string; ops: SegmentOp[]; max: number }> = {
  orders: { label: 'Number of orders', unit: 'orders', ops: ['gte', 'lte', 'eq'], max: 10_000 },
  spent: { label: 'Total spent', unit: '£', ops: ['gte', 'lte'], max: 10_000_000 },
  daysSinceOrder: { label: 'Days since last order', unit: 'days', ops: ['gte', 'lte'], max: 3650 },
  marketing: { label: 'Agreed to marketing email', unit: '', ops: ['eq'], max: 1 },
};
export const OP_LABEL: Record<SegmentOp, string> = { gte: 'at least', lte: 'at most', eq: 'is exactly' };
export const MAX_SEGMENT_RULES = 8; export const MAX_SEGMENTS = 50; export const MAX_SEGMENT_NAME = 60;
const DAY = 86_400_000;

/** Returns what is wrong, in plain words, or null when it is fine. */
export function validateSegment(name: string, d: unknown): string | null {
  if (!name.trim()) return 'Give the segment a name.'; if (name.trim().length > MAX_SEGMENT_NAME) return `Keep the name under ${MAX_SEGMENT_NAME} characters.`;
  const x = d as SegmentDefinition; if (!x || typeof x !== 'object' || (x.match !== 'all' && x.match !== 'any') || !Array.isArray(x.rules)) return 'The segment rules are not valid.';
  if (x.rules.length === 0) return 'Add at least one rule.'; if (x.rules.length > MAX_SEGMENT_RULES) return `Use at most ${MAX_SEGMENT_RULES} rules.`;
  for (const r of x.rules) {
    const f = SEGMENT_FIELDS[r?.field]; if (!f) return 'One rule uses something we cannot filter by.';
    if (!f.ops.includes(r.op)) return `"${f.label}" cannot be "${OP_LABEL[r.op] ?? r.op}".`;
    if (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0 || r.value > f.max) return `"${f.label}" needs a number from 0 to ${f.max.toLocaleString('en-GB')}.`;
    if (r.field !== 'spent' && !Number.isInteger(r.value)) return `"${f.label}" needs a whole number.`;
    if (r.field === 'marketing' && r.value !== 0 && r.value !== 1) return 'Marketing is either yes or no.';
  }
  return null;
}
/** Days since the last order, or Infinity for someone who has never ordered. */
const days = (iso: string, now: Date) => (iso ? Math.floor((now.getTime() - Date.parse(iso)) / DAY) : Infinity);
export function inSegment(c: SegmentCustomer, d: SegmentDefinition, now = new Date()): boolean {
  const test = (r: SegmentRule) => {
    const have = r.field === 'orders' ? c.orders : r.field === 'spent' ? c.spentMinor / 100 : r.field === 'daysSinceOrder' ? days(c.lastOrder, now) : c.marketing ? 1 : 0;
    return r.op === 'gte' ? have >= r.value : r.op === 'lte' ? have <= r.value : have === r.value;
  };
  return d.match === 'all' ? d.rules.every(test) : d.rules.some(test);
}
export function describeRule(r: SegmentRule): string {
  const f = SEGMENT_FIELDS[r.field]; if (r.field === 'marketing') return r.value ? 'Agreed to marketing email' : 'Has not agreed to marketing email';
  return `${f.label} ${OP_LABEL[r.op]} ${r.field === 'spent' ? `£${r.value.toLocaleString('en-GB')}` : `${r.value.toLocaleString('en-GB')} ${r.value === 1 ? f.unit.replace(/s$/, '') : f.unit}`}`;
}
export function describeSegment(d: SegmentDefinition): string { return d.rules.map(describeRule).join(d.match === 'all' ? ' and ' : ' or '); }
