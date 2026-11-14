import type { MetadataRoute } from 'next';
import { SITE } from '@/config';
export default function robots(): MetadataRoute.Robots {
  // Block everything outside production so staging and previews are never indexed.
  const prod = process.env.APP_ENV === 'production';
  return prod ? { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.url}/sitemap.xml` } : { rules: { userAgent: '*', disallow: '/' } };
}
