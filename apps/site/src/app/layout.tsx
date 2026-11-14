import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { ToastProvider } from '@oss-commerce/ui';
import '@oss-commerce/ui/ui.css';
import './globals.css';
import { SITE } from '@/config';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { StartProvider } from '@/components/Start';

const desc = 'A storefront designed and built for your business, with the shop engine behind it run for you. One monthly price, your own Stripe account, no app-store sprawl.';
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `Online shops that make sense | ${SITE.name} ${SITE.product}`, template: `%s | ${SITE.name} ${SITE.product}` },
  description: desc,
  openGraph: { type: 'website', siteName: `${SITE.name} ${SITE.product}`, locale: 'en_GB', description: desc },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3BA875' };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={GeistSans.variable}>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
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
