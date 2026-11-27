import { createHash, createHmac } from 'node:crypto';

/** The parts of visitor analytics that need nothing else: tidy a path, name a source, class a device, hash a visitor for one day. */
export type VisitKind = 'page' | 'product' | 'cart' | 'checkout' | 'purchase';
export const FLAG: Record<VisitKind, number> = { page: 1, product: 2, cart: 4, checkout: 8, purchase: 16 };
export const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|node-fetch/i;
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage)\./i; const SOCIAL = /(^|\.)(facebook|instagram|t\.co|twitter|x\.com|linkedin|pinterest|tiktok|youtube|reddit|threads)\b/i;
export const today = (d = new Date()) => d.toISOString().slice(0, 10);
/** A clean path: no query string, no fragment, no long ids that could identify someone, capped. */
export function cleanPath(p: string): string { let x = String(p ?? '').split('#')[0].split('?')[0].trim(); if (!x.startsWith('/')) x = '/' + x; x = x.replace(/\/{2,}/g, '/').replace(/\/[0-9a-f]{8,}(?=\/|$)/gi, '/:id').slice(0, 200); return x.length > 1 ? x.replace(/\/$/, '') : x; }
/** Where a visit came from, as a short label. Their own site and an empty referrer both read as Direct. */
export function sourceOf(referrer: string | undefined, ownHost?: string): string {
  if (!referrer) return 'Direct'; let h: string; try { h = new globalThis.URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'Direct'; }
  if (!h || (ownHost && (h === ownHost.toLowerCase().replace(/^www\./, '')))) return 'Direct'; if (SEARCH.test(h)) return 'Search'; if (SOCIAL.test(h)) return 'Social'; return h.slice(0, 60);
}
export const deviceOf = (width?: number) => (!width || width <= 0 ? 'd' : width < 640 ? 'm' : width < 1024 ? 't' : 'd');
export const dailyHash = (secret: string, day: string, address: string, agent: string) => createHash('sha256').update(createHmac('sha256', secret).update(day).digest('hex') + '|' + address + '|' + agent).digest('hex').slice(0, 16);

