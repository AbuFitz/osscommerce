import type { LegalPage } from './gateway';

export const LEGAL_META: Record<LegalPage['slug'], { title: string; template: string }> = {
  privacy: { title: 'Privacy policy', template: 'This privacy policy is provided by {{business name}} at {{business address}}. Contact {{support email}}.\n\nExplain what personal data you collect, why you use it, who receives it, how long you keep it, and how customers can exercise their rights.' },
  terms: { title: 'Terms and conditions', template: 'These terms apply to purchases from {{business name}} at {{business address}}. Contact {{support email}}.\n\nExplain ordering, prices, payment, cancellation, delivery, liability and dispute handling.' },
  shipping: { title: 'Shipping policy', template: '{{business name}} dispatches orders according to these delivery terms.\n\nDelivery times: {{delivery times}}. Explain destinations, prices, dispatch timing, delays and lost parcels.' },
  returns: { title: 'Returns and refunds policy', template: '{{business name}} accepts eligible returns within {{returns window}}. Contact {{support email}} before returning an item.\n\nExplain exclusions, return postage, inspection, refund timing and statutory rights.' },
};
export const LEGAL_SLUGS = Object.keys(LEGAL_META) as LegalPage['slug'][];
export const LEGAL_TOKENS = ['{{business name}}', '{{business address}}', '{{support email}}', '{{delivery times}}', '{{returns window}}'];

export function legalPagesFromRows(rows: Record<string, any>[]): LegalPage[] {
  const by = new Map(rows.map(r => [String(r.entry).replace(/^legal\//, ''), r]));
  return LEGAL_SLUGS.map(slug => { const r = by.get(slug); const meta = LEGAL_META[slug]; return { slug, title: meta.title, status: !r ? 'not_set_up' : r.published_at ? 'published' : 'draft', updatedAt: r ? new Date(r.created_at).toISOString() : undefined, body: typeof r?.body?.body === 'string' ? r.body.body : meta.template }; });
}

export function validateLegalBody(slug: string, body: string, publish: boolean): { ok: true; slug: LegalPage['slug']; body: string } | { ok: false; message: string } {
  if (!(slug in LEGAL_META)) return { ok: false, message: 'That legal page does not exist.' };
  const clean = body.trim(); if (!clean) return { ok: false, message: 'Add the policy text before saving.' }; if (clean.length > 20_000) return { ok: false, message: 'Keep the policy under 20,000 characters.' };
  if (publish) { const unresolved = LEGAL_TOKENS.filter(t => clean.includes(t)); if (unresolved.length) return { ok: false, message: `Replace ${unresolved.join(', ')} before publishing.` }; }
  return { ok: true, slug: slug as LegalPage['slug'], body: clean };
}
