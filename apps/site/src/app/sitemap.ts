import type { MetadataRoute } from 'next';
import { SITE } from '@/config';
import { LEGAL_DOCS } from '@/content/legal';
import { FEATURES } from '@/content/features';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/platform', ...FEATURES.map(f => `/features/${f.slug}`), '/how-it-works', '/pricing', '/start', '/contact', '/legal', ...LEGAL_DOCS.map(d => `/legal/${d.slug}`)].map(p => ({ url: SITE.url + p }));
}
