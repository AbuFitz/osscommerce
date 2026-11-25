import data from './places.json';
/**
 * Offline place lookup for the live map. Delivery towns are matched against a bundled gazetteer (GeoNames, CC BY 4.0), so no
 * customer address is ever sent to an outside geocoding service. Unknown towns fall back to the middle of their country.
 */
export type Located = { lat: number; lng: number; place: string; precision: 'town' | 'country' };
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
let index: Map<string, [number, number]> | undefined;
const idx = () => index ??= new Map((data.places as unknown as [string, string, number, number][]).map(p => [`${p[1]}|${p[0]}`, [p[2], p[3]] as [number, number]]));
const names = data.names as Record<string, string>; const centres = data.countries as unknown as Record<string, [number, number]>;
const ALIAS: Record<string, string> = { uk: 'GB', 'united kingdom': 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB', usa: 'US', 'united states': 'US', 'united states of america': 'US', eire: 'IE', ireland: 'IE' };
export function countryCode(input?: string | null): string | undefined {
  const s = (input ?? '').trim(); if (!s) return undefined; if (/^[A-Za-z]{2}$/.test(s)) { const c = s.toUpperCase(); return c === 'UK' ? 'GB' : names[c] ? c : undefined; }
  const n = norm(s); if (ALIAS[n]) return ALIAS[n]; return Object.entries(names).find(([, v]) => norm(v) === n)?.[0];
}
export function locate(city?: string | null, country?: string | null): Located | null {
  const cc = countryCode(country); if (!cc) return null;
  const c = norm(city ?? ''); const hit = c ? idx().get(`${cc}|${c}`) : undefined;
  if (hit) return { lat: hit[0], lng: hit[1], place: `${(city ?? '').trim().replace(/\b\w/g, m => m.toUpperCase()) || c}, ${names[cc]}`, precision: 'town' };
  const mid = centres[cc]; return mid ? { lat: mid[0], lng: mid[1], place: names[cc], precision: 'country' } : null;
}
export const attribution = data.attribution as string;
