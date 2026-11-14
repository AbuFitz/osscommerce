import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/inter';
import { ToastProvider } from '@oss-commerce/ui';
import '@oss-commerce/ui/ui.css';
import './globals.css';
import { SITE } from '@/config';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { StartProvider } from '@/components/Start';

const desc = 'A bespoke online shop with everything you need to sell, manage and grow. Designed around your business, powered by OSS Commerce, and looked after by our technical team.';
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `Your store. Your brand. Built for you. | ${SITE.name} ${SITE.product}`, template: `%s | ${SITE.name} ${SITE.product}` },
  description: desc,
  openGraph: { type: 'website', siteName: `${SITE.name} ${SITE.product}`, locale: 'en_GB', description: desc },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0f0d' };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <ToastProvider><StartProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <Footer />
        </StartProvider></ToastProvider>
      </body>
    </html>
  );
}
