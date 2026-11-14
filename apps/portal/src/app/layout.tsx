import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Bell, ChevronsUpDown, Search } from 'lucide-react';
import Link from 'next/link';
import { Rail, TabBar } from '@/components/Nav';
import { gateway } from '@/lib/gateway-instance';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Commerce', template: '%s · OSS Commerce' }, robots: { index: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#e4e9d4' };

function Switcher({ name }: { name: string }) {
  return <button className="switch" type="button" aria-label={`Store: ${name}. Switch store`}><span className="mk" aria-hidden>{name[0]}</span><span><small>Store</small><b>{name}</b></span><ChevronsUpDown size={15} aria-hidden /></button>;
}
const Bellink = ({ n }: { n: number }) => <Link className="iconbtn" href="/orders?filter=attention" aria-label={n ? `${n} needs attention` : 'Notifications'}><Bell size={18} aria-hidden />{n > 0 && <span className="dot" />}</Link>;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const g = gateway();
  const [s, attention] = await Promise.all([g.store(), g.orders({ filter: 'attention' })]);
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
        <div className="backdrop" aria-hidden><i /><i /><i /></div>
        <div className="frame">
          <Rail initials="MO" />
          <div className="stage">
            <header className="top">
              <Switcher name={s.name} /><div className="spacer" />
              <form className="searchpill" role="search" action="/orders"><Search size={16} aria-hidden /><label className="sr" htmlFor="gq">Search orders</label><input id="gq" name="q" placeholder="Search orders and customers" /></form>
              <Bellink n={attention.length} />
            </header>
            <header className="topbar"><Switcher name={s.name} /><div className="spacer" /><Bellink n={attention.length} /></header>
            <main id="main">{children}</main>
          </div>
        </div>
        <TabBar />
      </body>
    </html>
  );
}
