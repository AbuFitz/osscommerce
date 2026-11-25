import { ScrollFades } from '@/components/ScrollFades';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ToastProvider } from '@oss-commerce/ui';
import '@oss-commerce/ui/ui.css';
import './globals.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: { default: 'Commerce', template: '%s · OneSimpleCommerce' }, robots: { index: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#dddde0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
        <div className="backdrop" aria-hidden><i /><i /><i /></div>
        <ToastProvider>{children}</ToastProvider>
        <ScrollFades />
      </body>
    </html>
  );
}
