import { parseZoneTokens, postcodeTokens } from '@oss-commerce/contracts';
import type { RateWhen, ZoneRate, WeightBand } from './gateway';

/** Rules for delivery options, shared by the live engine adapter, the demo and the editor so they can never disagree. */
const money = (m: number) => `£${(m / 100).toFixed(m % 100 === 0 ? 0 : 2)}`;
const kg = (g: number) => (g % 1000 === 0 ? `${g / 1000} kg` : g < 1000 ? `${g} g` : `${(g / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} kg`);

/** A short, plain description of when an option is offered, e.g. "orders £30 to £60, up to 2 kg". Empty when it is always offered. */
export function describeWhen(w?: RateWhen): string {
  if (!w) return ''; const out: string[] = [];
  if (w.minOrderMinor && w.maxOrderMinor) out.push(`orders ${money(w.minOrderMinor)} to ${money(w.maxOrderMinor)}`); else if (w.minOrderMinor) out.push(`orders of ${money(w.minOrderMinor)} or more`); else if (w.maxOrderMinor) out.push(`orders up to ${money(w.maxOrderMinor)}`);
  if (w.maxWeightGrams) out.push(`up to ${kg(w.maxWeightGrams)}`);
  return out.join(', ');
}
export function describePrice(r: ZoneRate): string {
  if (r.bands?.length) return `${money(Math.min(...r.bands.map(b => b.priceMinor)))} to ${money(Math.max(...r.bands.map(b => b.priceMinor)))} by weight`;
  return r.priceMinor === 0 ? 'Free' : money(r.priceMinor);
}
/** Returns a reason the option cannot be saved, or null. */
export function validateRate(r: ZoneRate): string | null {
  const label = r.label.trim(); if (!label || label.length > 80) return 'Each delivery option needs a name of no more than 80 characters.';
  const w = r.when; const whole = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 0);
  if (!Number.isInteger(r.priceMinor) || r.priceMinor < 0) return `${label}: the price must be zero or more.`;
  if (r.freeOverMinor !== undefined && (!Number.isInteger(r.freeOverMinor) || r.freeOverMinor < 1)) return `${label}: a free-delivery threshold must be at least 0.01.`;
  if (w) {
    if (!whole(w.minOrderMinor) || !whole(w.maxOrderMinor) || !whole(w.maxWeightGrams)) return `${label}: limits must be whole, positive numbers.`;
    if (w.minOrderMinor && w.maxOrderMinor && w.minOrderMinor > w.maxOrderMinor) return `${label}: the smallest order cannot be bigger than the largest.`;
    if (w.maxWeightGrams !== undefined && w.maxWeightGrams > 0 && w.maxWeightGrams < 1) return `${label}: the weight limit is too small.`;
  }
  if (r.bands) {
    if (r.bands.length < 1 || r.bands.length > 12) return `${label}: add between 1 and 12 weight bands.`;
    let last = 0; for (const b of r.bands) { if (!Number.isInteger(b.upToGrams) || b.upToGrams <= last) return `${label}: weight bands must go up, each heavier than the last.`; if (!Number.isInteger(b.priceMinor) || b.priceMinor < 0) return `${label}: each band needs a price of zero or more.`; last = b.upToGrams; }
    if (r.freeOverMinor) return `${label}: free-over is for flat prices. For weight bands, set a band to £0 instead.`;
  }
  return null;
}
export const bandsJson = (b: WeightBand[]) => JSON.stringify(b.map(x => ({ upToGrams: x.upToGrams, price: x.priceMinor })));
export const bandsFromJson = (json: string): WeightBand[] | undefined => { try { const a = JSON.parse(json) as { upToGrams: number; price: number }[]; return Array.isArray(a) && a.length ? a.map(x => ({ upToGrams: x.upToGrams, priceMinor: x.price })) : undefined; } catch { return undefined; } };

/** Splits a zone's region list into countries (matched against what is enabled) and UK postcode areas, ranges or outward codes. A name that is both (such as IM) is read as the country. */
export function splitRegions(regions: string, countries: { code: string; name: string; enabled: boolean }[]): { codes: string[]; postcodes: string; unknown: string[] } {
  const aliases: Record<string, string> = { uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB', 'united kingdom': 'GB', usa: 'US', 'united states': 'US' };
  const enabled = countries.filter(c => c.enabled); const codes: string[] = []; const pc: string[] = []; const unknown: string[] = [];
  for (const raw of regions.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean)) {
    const lower = raw.toLowerCase(); const alias = aliases[lower]; const found = enabled.find(c => c.code.toLowerCase() === lower || c.name.toLowerCase() === lower || c.code === alias);
    if (found) { codes.push(found.code.toUpperCase()); continue; }
    if (postcodeTokens(raw).length) { pc.push(raw.toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '')); continue; }
    unknown.push(raw);
  }
  const hasPostcodes = pc.length > 0; if (hasPostcodes && !codes.includes('GB')) codes.push('GB');
  return { codes: [...new Set(codes)], postcodes: pc.join(','), unknown };
}
/** For each zone, the postcode areas it must NOT serve because a more specific zone does. A catch-all zone excludes every other zone's postcode areas; a zone that lists its own postcode areas serves exactly those. */
export function exclusionsFor(zones: { name: string; postcodes: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const z of zones) out.set(z.name, z.postcodes ? '' : [...new Set(zones.filter(o => o.name !== z.name && o.postcodes).flatMap(o => o.postcodes.split(',')))].join(','));
  return out;
}
export const hasPostcodeAreas = (regions: string) => parseZoneTokens(regions).some(t => t.kind !== 'fallback');

/** The options a customer with this basket would be offered by one zone, with the price each would cost. The same rules the engine applies. */
export function offeredRates(rates: ZoneRate[], o: { basketMinor: number; weightGrams: number }): { label: string; priceMinor: number }[] {
  return rates.filter(r => { const w = r.when; if (!w) return true; return !(w.minOrderMinor && o.basketMinor < w.minOrderMinor) && !(w.maxOrderMinor && o.basketMinor > w.maxOrderMinor) && !(w.maxWeightGrams && o.weightGrams > w.maxWeightGrams); })
    .map(r => ({ label: r.label, priceMinor: r.bands?.length ? (r.bands.find(b => o.weightGrams <= b.upToGrams) ?? r.bands[r.bands.length - 1]).priceMinor : r.freeOverMinor && o.basketMinor >= r.freeOverMinor ? 0 : r.priceMinor }));
}
