import { sanitizeRichText, plainText } from '@oss-commerce/contracts';
import { safeContentLink } from './homepage-content';

/**
 * Pages and menus a merchant edits for their storefront. Stored in the same draft-and-publish store as the homepage and the legal pages, so a storefront
 * only ever reads what the merchant has published. Menus are `menu/header` and `menu/footer`; custom pages are `site/<slug>`.
 */
export type MenuKey = 'header' | 'footer';
export const MENUS: Record<MenuKey, { title: string; hint: string }> = { header: { title: 'Header menu', hint: 'Along the top of every page.' }, footer: { title: 'Footer menu', hint: 'At the bottom of every page.' } };
export interface MenuItem { label: string; link: string }
export interface MenuView { key: MenuKey; title: string; items: MenuItem[]; status: 'not_set_up' | 'draft' | 'published' | 'changed'; publishedItems: MenuItem[] }
export const MAX_MENU_ITEMS = 12;

export function validateMenu(key: string, items: MenuItem[]): { ok: true; key: MenuKey; items: MenuItem[] } | { ok: false; message: string } {
  if (!(key in MENUS)) return { ok: false, message: 'That menu does not exist.' };
  if (!Array.isArray(items) || items.length > MAX_MENU_ITEMS) return { ok: false, message: `A menu can have up to ${MAX_MENU_ITEMS} links.` };
  const out: MenuItem[] = [];
  for (const [i, it] of items.entries()) {
    const label = String(it?.label ?? '').trim(); const link = String(it?.link ?? '').trim();
    if (!label) return { ok: false, message: `Link ${i + 1} needs a name.` }; if (label.length > 30) return { ok: false, message: `Link ${i + 1}: keep the name under 30 characters.` };
    if (!link) return { ok: false, message: `Link ${i + 1} needs somewhere to go.` }; if (link.length > 300) return { ok: false, message: `Link ${i + 1}: that address is too long.` };
    if (!safeContentLink(link)) return { ok: false, message: `Link ${i + 1}: use a page on your shop (starting with /) or a full https:// address.` };
    out.push({ label, link });
  }
  return { ok: true, key: key as MenuKey, items: out };
}
export function menusFromRows(rows: Record<string, any>[]): MenuView[] {
  const by = new Map(rows.map(r => [String(r.entry).replace(/^menu\//, ''), r]));
  const read = (body: any): MenuItem[] => Array.isArray(body?.items) ? body.items.filter((i: any) => typeof i?.label === 'string' && typeof i?.link === 'string') : [];
  return (Object.keys(MENUS) as MenuKey[]).map(key => { const r = by.get(key); const pub = r?.published_at ? read(r.body) : null;
    return { key, title: MENUS[key].title, items: r ? read(r.body) : [], publishedItems: pub ?? [], status: !r ? 'not_set_up' : !r.published_at ? 'draft' : 'published' } as MenuView; });
}

export interface SitePage { slug: string; title: string; body: string; seoDescription: string; status: 'draft' | 'published'; updatedAt?: string }
export const RESERVED_SLUGS = new Set(['privacy', 'terms', 'shipping', 'returns', 'cart', 'checkout', 'account', 'login', 'collections', 'products', 'search', 'admin', 'api', 'home', 'new', 'orders', 'pages', 'blog']);
export const slugify = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export function validatePage(p: { slug: string; title: string; body: string; seoDescription?: string }, publish: boolean): { ok: true; page: { slug: string; title: string; body: string; seoDescription: string } } | { ok: false; message: string } {
  const title = p.title.trim(); if (!title) return { ok: false, message: 'Give the page a title.' }; if (title.length > 80) return { ok: false, message: 'Keep the title under 80 characters.' };
  const slug = p.slug.trim(); if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug)) return { ok: false, message: 'The address can use lowercase letters, numbers and dashes only.' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, message: `"${slug}" is used by your shop already. Choose another address.` };
  const body = sanitizeRichText(p.body); if (publish && !plainText(body)) return { ok: false, message: 'Write something on the page before publishing.' };
  if (body.length > 20_000) return { ok: false, message: 'Keep the page under 20,000 characters.' };
  const seoDescription = (p.seoDescription ?? '').trim(); if (seoDescription.length > 160) return { ok: false, message: 'Keep the search description under 160 characters.' };
  return { ok: true, page: { slug, title, body, seoDescription } };
}
/** The latest revision of each page; a deleted page is stored as `{ deleted: true }` and drops out. */
export function pagesFromRows(rows: Record<string, any>[]): SitePage[] {
  return rows.filter(r => r.body && !r.body.deleted).map(r => ({ slug: String(r.entry).replace(/^site\//, ''), title: String(r.body.title ?? ''), body: String(r.body.body ?? ''), seoDescription: String(r.body.seoDescription ?? ''), status: r.published_at ? 'published' as const : 'draft' as const, updatedAt: new Date(r.published_at ?? r.created_at).toISOString() })).sort((a, b) => a.title.localeCompare(b.title));
}
