'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { commerce, account } from './nav-data';

const active = (p: string, h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(h + '/'));

export function SideNav() {
  const p = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {commerce.map(({ href, label, icon: I }) => (
        <Link key={href} href={href} aria-current={active(p, href) ? 'page' : undefined}><I size={17} aria-hidden />{label}</Link>
      ))}
      <div className="grp">Your account</div>
      {account.map(({ href, label, icon: I }) => (
        <Link key={href} href={href} aria-current={active(p, href) ? 'page' : undefined}><I size={17} aria-hidden />{label}</Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const p = usePathname();
  const t = [commerce[0], commerce[1], commerce[2], { href: '/more', label: 'More', icon: Menu }];
  const moreActive = ['/inventory', '/customers', '/settings', '/more', '/account'].some(h => active(p, h));
  return (
    <nav className="tabbar" aria-label="Main">
      {t.map(({ href, label, icon: I }) => {
        const cur = href === '/more' ? moreActive : active(p, href);
        return <Link key={href} href={href} aria-current={cur ? 'page' : undefined}><I size={21} aria-hidden />{label}</Link>;
      })}
    </nav>
  );
}

