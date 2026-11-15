import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/funnel-display';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './globals.css';
import { SITE } from '@/config';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { WhatsApp } from '@/components/WhatsApp';

const desc = 'A bespoke online store, a powerful commerce platform, and a team that takes care of the technology. We build the store. You run the business.';
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: we build the store, you run the business`, template: `%s | ${SITE.name}` },
  description: desc,
  openGraph: { type: 'website', siteName: SITE.name, locale: 'en_GB', description: desc, images: ['/shots/overview.jpg'] },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0e1311' };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <Footer />
        <WhatsApp />
      </body>
    </html>
  );
}
