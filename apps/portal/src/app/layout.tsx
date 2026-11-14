import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ChevronsUpDown } from 'lucide-react';
import { SideNav, TabBar } from '@/components/Nav';
import { gateway } from '@/lib/gateway-instance';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Commerce', template: '%s · OSS Commerce' }, robots: { index: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

function Switcher({ name }: { name: string }) {
  return <button className="switch" type="button" aria-label={`Store: ${name}. Switch store`}><span><small>Store</small><b>{name}</b></span><ChevronsUpDown size={15} aria-hidden /></button>;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await gateway().store();
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`} style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
        <div className="shell">
          <aside className="side">
            <div className="brand">oss<i>.</i></div>
            <Switcher name={s.name} />
            <SideNav />
            <div className="foot">Demo data · not a live store</div>
          </aside>
          <div style={{ minWidth: 0 }}>
            <header className="topbar"><div className="brand">oss<i>.</i></div><Switcher name={s.name} /></header>
            <main className="main" id="main">{children}</main>
          </div>
        </div>
        <TabBar />
      </body>
    </html>
  );
}
