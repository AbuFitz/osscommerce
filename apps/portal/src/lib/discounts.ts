import type { Discount, DiscountInput } from './gateway';

const money = (minor: number) => `£${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const day = (ymd: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`));
export const CODE = /^[A-Z0-9]{2,24}$/;

/** The one rule set for a discount, used by the form, the demo and the engine adapter so they can never disagree. Returns the first problem in plain words, or null. */
export function validateDiscount(d: DiscountInput, today: string): string | null {
  if (d.method === 'code') { const c = (d.code ?? '').trim().toUpperCase(); if (!CODE.test(c)) return 'Use 2 to 24 letters and numbers for the code.'; }
  if (d.kind === 'percent' && !(d.value >= 1 && d.value <= 100)) return 'A percentage discount must be between 1 and 100.';
  if (d.kind === 'fixed' && !(Number.isInteger(d.value) && d.value >= 1)) return 'Enter an amount of at least 1p.';
  if (d.kind === 'bogo') {
    if (!Number.isInteger(d.buy) || (d.buy ?? 0) < 1 || !Number.isInteger(d.get) || (d.get ?? 0) < 1) return 'Say how many to buy and how many come free (whole numbers, at least 1).';
    if (!d.productIds?.length) return 'Choose which products the offer applies to.';
  }
  if (d.kind === 'fixed' && d.productIds?.length) return 'A fixed amount comes off the whole order. Use a percentage to discount chosen products.';
  if (d.kind === 'shipping' && d.productIds?.length) return 'Free shipping applies to the whole order.';
  if (d.minSpendMinor !== undefined && !(Number.isInteger(d.minSpendMinor) && d.minSpendMinor >= 0)) return 'The minimum spend must be zero or more.';
  if (d.limit !== undefined && !(Number.isInteger(d.limit) && d.limit >= 1)) return 'Total uses must be at least 1.';
  if (d.perCustomer !== undefined && !(Number.isInteger(d.perCustomer) && d.perCustomer >= 1)) return 'Uses per customer must be at least 1.';
  const re = /^\d{4}-\d{2}-\d{2}$/;
  for (const [l, v] of [['start', d.startDate], ['end', d.endDate]] as const) if (v && (!re.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`)))) return `Choose a valid ${l} date.`;
  if (d.startDate && d.endDate && d.endDate < d.startDate) return 'The end date is before the start date.';
  if (d.endDate && d.endDate < today && d.enabled) return 'The end date has already passed.';
  return null;
}

/** One sentence a merchant can read to check what they have set up. Used live in the form and on each card. */
export function describeDiscount(d: Pick<DiscountInput, 'kind' | 'value' | 'minSpendMinor' | 'buy' | 'get' | 'limit' | 'perCustomer' | 'startDate' | 'endDate' | 'method' | 'code'> & { productNames?: string[] }): string {
  const what = d.productNames?.length ? (d.productNames.length <= 2 ? d.productNames.join(' and ') : `${d.productNames.length} chosen products`) : null;
  const core = d.kind === 'percent' ? `${d.value || '…'}% off ${what ?? 'the whole order'}` : d.kind === 'fixed' ? `${money(d.value || 0)} off the whole order` : d.kind === 'shipping' ? 'Free delivery' : d.kind === 'bogo' ? `Buy ${d.buy || '…'}, get ${d.get || '…'} free${what ? ` on ${what}` : ''}` : 'A custom discount';
  const parts = [core];
  if (d.minSpendMinor) parts.push(`on orders over ${money(d.minSpendMinor)}`);
  const how = d.method === 'code' ? (d.code ? `with code ${d.code.toUpperCase()}` : 'with a code') : 'applied automatically';
  if (d.method === 'code') parts.push(how);
  const when = d.startDate && d.endDate ? `${day(d.startDate)} to ${day(d.endDate)}` : d.startDate ? `from ${day(d.startDate)}` : d.endDate ? `until ${day(d.endDate)}` : '';
  const caps = [d.limit ? `${d.limit} uses in total` : '', d.perCustomer ? `${d.perCustomer} per customer` : ''].filter(Boolean).join(', ');
  return `${parts.join(' ')}${d.method === 'automatic' ? `, ${how}` : ''}${when ? `, ${when}` : ''}${caps ? ` (${caps})` : ''}.`;
}

export const statusOf = (p: { enabled: boolean; startsAt?: string | null; endsAt?: string | null }, now = new Date()): Discount['status'] => {
  if (p.endsAt && new Date(p.endsAt) <= now) return 'expired'; if (!p.enabled) return 'paused'; if (p.startsAt && new Date(p.startsAt) > now) return 'scheduled'; return 'active';
};
