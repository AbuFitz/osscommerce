import type { ContentSection, ContentView } from './gateway';

export type ContentField = { key: string; label: string; max: number; required?: boolean; multiline?: boolean; hint?: string; link?: boolean };

export const HOME_SECTION_SCHEMA: Record<ContentSection['type'], ContentField[]> = {
  announcement: [{ key: 'text', label: 'Message', max: 90, required: true }, { key: 'link', label: 'Link', max: 120, link: true, hint: 'A page on your shop (starts with /) or a full https:// address.' }],
  hero: [{ key: 'headline', label: 'Headline', max: 60, required: true }, { key: 'subheading', label: 'Subheading', max: 120 }, { key: 'buttonLabel', label: 'Button label', max: 24 }, { key: 'buttonLink', label: 'Button link', max: 120, link: true }],
  image_text: [{ key: 'heading', label: 'Heading', max: 60, required: true }, { key: 'body', label: 'Text', max: 280, multiline: true }],
  product_row: [{ key: 'heading', label: 'Heading', max: 60, required: true }, { key: 'collection', label: 'Collection', max: 60, hint: 'The collection to show products from.' }],
  faq: [{ key: 'heading', label: 'Heading', max: 60, required: true }, { key: 'body', label: 'Text', max: 400, multiline: true }],
};

type StoredSection = Omit<ContentSection, 'changed'>;
export interface HomepageBody { sections: StoredSection[] }

export function safeContentLink(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}

export function defaultHomepage(storeName: string): HomepageBody {
  const name = storeName.trim().slice(0, 60) || 'Our shop';
  return { sections: [
    { id: 'announcement', type: 'announcement', label: 'Announcement bar', fields: { text: `Welcome to ${name}`, link: '' } },
    { id: 'hero', type: 'hero', label: 'Hero', fields: { headline: name, subheading: '', buttonLabel: 'Shop now', buttonLink: '/collections/all' } },
    { id: 'featured', type: 'product_row', label: 'Featured products', fields: { heading: 'Featured products', collection: '' } },
  ] };
}

export function validateSectionFields(type: ContentSection['type'], input: Record<string, string>): { ok: true; fields: Record<string, string> } | { ok: false; message: string } {
  const schema = HOME_SECTION_SCHEMA[type]; const allowed = new Set(schema.map(f => f.key));
  if (Object.keys(input).some(key => !allowed.has(key))) return { ok: false, message: 'That section contains an unsupported field.' };
  const fields: Record<string, string> = {};
  for (const field of schema) {
    const value = typeof input[field.key] === 'string' ? input[field.key].trim() : '';
    if (field.required && !value) return { ok: false, message: `${field.label} is required.` };
    if (value.length > field.max) return { ok: false, message: `${field.label} must be ${field.max} characters or fewer.` };
    if (field.link && !safeContentLink(value)) return { ok: false, message: `${field.label} must start with / or use a full https:// address.` };
    fields[field.key] = value;
  }
  return { ok: true, fields };
}

export function parseHomepageBody(value: unknown): HomepageBody {
  const raw = value as { sections?: unknown[] } | null;
  if (!raw || !Array.isArray(raw.sections) || raw.sections.length < 1 || raw.sections.length > 20) throw new Error('The saved homepage content is invalid.');
  const ids = new Set<string>(); const sections: StoredSection[] = raw.sections.map(value => {
    const section = value as Partial<StoredSection>;
    if (typeof section.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(section.id) || ids.has(section.id)) throw new Error('The saved homepage content is invalid.');
    if (typeof section.type !== 'string' || !(section.type in HOME_SECTION_SCHEMA) || typeof section.label !== 'string' || !section.label.trim() || section.label.length > 80 || !section.fields || typeof section.fields !== 'object') throw new Error('The saved homepage content is invalid.');
    ids.add(section.id); const checked = validateSectionFields(section.type as ContentSection['type'], section.fields as Record<string, string>);
    if (!checked.ok) throw new Error('The saved homepage content is invalid.');
    return { id: section.id, type: section.type as ContentSection['type'], label: section.label.trim(), fields: checked.fields };
  });
  return { sections };
}

const same = (a: StoredSection | undefined, b: StoredSection | undefined) => JSON.stringify(a) === JSON.stringify(b);

export function homepageView(rows: Record<string, any>[], storeName: string, shopUrl?: string): ContentView {
  const latest = rows[0]; const published = rows.find(row => row.published_at);
  const current = latest ? parseHomepageBody(latest.body) : defaultHomepage(storeName);
  const live = published ? parseHomepageBody(published.body) : null;
  return {
    page: { id: 'home', title: 'Homepage', path: '/' },
    sections: current.sections.map(section => ({ ...section, changed: !same(section, live?.sections.find(item => item.id === section.id)) })),
    publishedAt: published ? new Date(published.published_at).toISOString() : '',
    previewUrl: shopUrl && /^https:\/\//.test(shopUrl) ? shopUrl : '#',
    versions: rows.filter(row => row.published_at).map((row, index) => ({ id: `home-${row.revision}`, at: new Date(row.published_at).toISOString(), note: `Homepage revision ${row.revision}`, current: index === 0 })),
  };
}
