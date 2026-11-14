import type { MetadataRoute } from 'next';
import { SITE } from '@/config';
import { LEGAL_DOCS } from '@/content/legal';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;
  return ['', '/storefronts', '/pricing', '/contact', '/legal', ...LEGAL_DOCS.map(d => `/legal/${d.slug}`)].map(p => ({ url: base + p }));
}
