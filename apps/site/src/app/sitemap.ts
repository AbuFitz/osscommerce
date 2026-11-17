import type { MetadataRoute } from 'next';
import { SITE } from '@/config';
import { LEGAL_DOCS } from '@/content/legal';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/stores', '/platform', '/payments', '/custom', '/integrations', '/pricing', '/how-it-works', '/start', '/contact', '/legal', ...LEGAL_DOCS.map(d => `/legal/${d.slug}`)].map(p => ({ url: SITE.url + p }));
}
