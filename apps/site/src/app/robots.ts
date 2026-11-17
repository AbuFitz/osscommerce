import type { MetadataRoute } from 'next';
import { SITE } from '@/config';
export default function robots(): MetadataRoute.Robots {
  const prod = process.env.APP_ENV === 'production';   // never index staging or previews
  return prod ? { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.url}/sitemap.xml` } : { rules: { userAgent: '*', disallow: '/' } };
}
