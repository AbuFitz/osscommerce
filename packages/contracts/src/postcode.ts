/**
 * UK postcode coverage rules for delivery zones. Pure and data-free: a zone lists outward-code tokens such as
 * "IV", "PA20–80" or "SW1A"; the most specific token that matches a postcode wins. Country names and "UK" only
 * match as a last resort, because telling which country a postcode is in needs boundary data we have not licensed
 * (see docs/engine/map-research.md).
 */
export interface OutwardCode { area: string; district: number | null; suffix: string }
export type ZoneToken = { kind: 'area'; area: string } | { kind: 'district'; area: string; from: number; to: number } | { kind: 'outward'; area: string; district: number; suffix: string } | { kind: 'fallback'; label: string };
const FALLBACK = /^(uk|united kingdom|great britain|gb|england|scotland|wales|northern ireland|rest of (the )?(uk|world)|everywhere)$/i;

/** Parses a full or partial UK postcode. Returns null when it cannot be one. */
export function parsePostcode(input: string): OutwardCode | null {
  const s = input.toUpperCase().replace(/\s+/g, ''); const m = /^([A-Z]{1,2})(\d{1,2})([A-Z]?)(\d[A-Z]{2})?$/.exec(s); if (!m) return null;
  return { area: m[1], district: Number(m[2]), suffix: m[3] };
}
export function parseZoneTokens(regions: string): ZoneToken[] {
  const out: ZoneToken[] = [];
  for (const raw of regions.split(/[,;\n]/).map(t => t.trim()).filter(Boolean)) {
    const t = raw.toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
    let m: RegExpExecArray | null;
    if (FALLBACK.test(raw)) out.push({ kind: 'fallback', label: raw });
    else if ((m = /^([A-Z]{1,2})$/.exec(t))) out.push({ kind: 'area', area: m[1] });
    else if ((m = /^([A-Z]{1,2})(\d{1,2})-(\d{1,2})$/.exec(t))) out.push({ kind: 'district', area: m[1], from: Math.min(+m[2], +m[3]), to: Math.max(+m[2], +m[3]) });
    else if ((m = /^([A-Z]{1,2})(\d{1,2})([A-Z]?)$/.exec(t))) out.push({ kind: 'outward', area: m[1], district: +m[2], suffix: m[3] });
    else out.push({ kind: 'fallback', label: raw });
  }
  return out;
}
const rank = (t: ZoneToken, p: OutwardCode): number => {
  if (t.kind === 'outward') return t.area === p.area && t.district === p.district && (t.suffix === '' || t.suffix === p.suffix) ? (t.suffix ? 4 : 3) : 0;
  if (t.kind === 'district') return t.area === p.area && p.district !== null && p.district >= t.from && p.district <= t.to ? 2 : 0;
  if (t.kind === 'area') return t.area === p.area ? 1 : 0;
  return 0;
};
/** Which zone serves this postcode: most specific token wins; a zone with a catch-all token is the fallback. */
export function zoneForPostcode<Z extends { name: string; regions: string }>(postcode: string, zones: Z[]): { zone: Z | null; via: 'specific' | 'fallback' | 'none'; invalid?: boolean } {
  const p = parsePostcode(postcode); if (!p) return { zone: null, via: 'none', invalid: true };
  let best: { z: Z; r: number } | null = null; let fb: Z | null = null;
  for (const z of zones) { const toks = parseZoneTokens(z.regions); for (const t of toks) { const r = rank(t, p); if (r && (!best || r > best.r)) best = { z, r }; } if (!fb && toks.some(t => t.kind === 'fallback')) fb = z; }
  return best ? { zone: best.z, via: 'specific' } : fb ? { zone: fb, via: 'fallback' } : { zone: null, via: 'none' };
}
