import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { SITE } from '@/config';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { WhatsApp } from '@/components/WhatsApp';

const desc = 'A bespoke online store, a powerful commerce platform, and a team that takes care of the technology. We build the store. You run the business.';
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: bespoke online stores on a platform that runs itself`, template: `%s | ${SITE.name}` },
  description: desc, openGraph: { type: 'website', siteName: SITE.name, locale: 'en_GB', description: desc }, twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, colorScheme: 'light dark' };
/** Applies the saved (or system) theme before first paint so there is no flash. */
const THEME = `try{var t=localStorage.getItem('osc-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head><body>
    <a className="skip" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /><WhatsApp />
  </body></html>);
}
