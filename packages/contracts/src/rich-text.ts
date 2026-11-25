/**
 * Product descriptions are stored as a small, safe subset of HTML, so every storefront can render them as they are, and nothing a merchant
 * (or anyone who got into a merchant's session) types can run script on a shopper's page. This is the one place that decides what is allowed;
 * it runs where descriptions are written, never only where they are shown.
 *
 * Allowed: paragraphs, line breaks, bold, italic, h2, h3, bulleted and numbered lists, quotes, and links to http, https or mailto.
 * Everything else is dropped but its text is kept, except script, style and similar, whose contents are dropped too.
 */
const KEEP = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3', div: 'p' };
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'head', 'title', 'textarea', 'select']);
const VOID = new Set(['br']);
export const MAX_RICH_TEXT = 20_000;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unesc = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] ?? m;
});
const INVISIBLE = new RegExp('[\\u0000-\\u0020\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029\\ufeff]', 'g');
/** Only web and email links. Entity and whitespace tricks ("java&#115;cript:", "java\nscript:") are undone first, then the scheme is checked. */
export function safeHref(raw: string): string | null {
  const v = unesc(raw).replace(INVISIBLE, '');
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v.length <= 2000 ? v : null;
  return null;
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<!--[\s\S]*?-->|<[!?][^>]*>/g;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

export function sanitizeRichText(input: string): string {
  const src = String(input ?? '').slice(0, MAX_RICH_TEXT * 2); let out = ''; let i = 0; let skip: string | null = null; const stack: string[] = [];
  const text = (t: string) => { if (!skip) out += esc(unesc(t)); };
  for (const m of src.matchAll(TAG)) {
    text(src.slice(i, m.index)); i = m.index! + m[0].length;
    if (!m[2]) continue;                                          // comments and doctype: nothing
    const closing = m[1] === '/'; let name = m[2].toLowerCase();
    if (skip) { if (closing && name === skip) skip = null; continue; }
    if (!closing && DROP_WITH_CONTENT.has(name)) { skip = name; continue; }
    name = RENAME[name] ?? name; if (!KEEP.has(name)) continue;
    if (closing) { const at = stack.lastIndexOf(name); if (at >= 0) { while (stack.length > at) out += `</${stack.pop()}>`; } continue; }
    if (name === 'a') { const h = HREF.exec(m[3]); const href = h ? safeHref(h[1] ?? h[2] ?? h[3] ?? '') : null; if (!href) continue; out += `<a href="${esc(href)}" rel="noopener noreferrer nofollow">`; stack.push('a'); continue; }
    if (VOID.has(name)) { out += `<${name}>`; continue; }
    out += `<${name}>`; stack.push(name);
  }
  text(src.slice(i)); while (stack.length) out += `</${stack.pop()}>`;
  return out.replace(/<(p|li|h2|h3|blockquote|strong|em)>\s*<\/\1>/g, '').trim().slice(0, MAX_RICH_TEXT);
}

/** An older plain-text description becomes paragraphs (blank line) and line breaks, escaped. Text that is already HTML is just cleaned. */
export function toRichText(value: string): string {
  const v = String(value ?? ''); if (!v.trim()) return '';
  if (/<\/?[a-z][^>]*>/i.test(v)) return sanitizeRichText(v);
  return v.trim().split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}
/** The words only, for a search-result preview, a meta description fallback or a character count. */
export function plainText(html: string): string {
  return unesc(String(html ?? '').replace(/<\/(p|li|h2|h3|blockquote)>|<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}
