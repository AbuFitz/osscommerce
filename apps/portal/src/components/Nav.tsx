'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { commerce, accountLink } from './nav-data';

const active = (p: string, h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(h + '/'));

export function Rail({ initials, hidden = [] }: { initials: string; hidden?: string[] }) {
  const p = usePathname();
  const item = (it: { href: string; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }) => (
    <Link key={it.href} href={it.href} data-label={it.label} aria-label={it.label} aria-current={active(p, it.href) ? 'page' : undefined}><it.icon size={19} aria-hidden /></Link>
  );
  return (
    <aside className="rail">
      <nav aria-label="Main" style={{ display: 'contents' }}>
        {commerce.slice(0, 8).filter(c => !hidden.includes(c.href)).map(item)}
        <hr />
        {item(commerce[8])}
        {item(accountLink)}
      </nav>
      <div className="grow" />
      <div className="avatar" title="Maya Okafor" aria-label="Signed in as Maya Okafor">{initials}</div>
    </aside>
  );
}

export function TabBar() {
  const p = usePathname();
  const t = [commerce[0], commerce[1], commerce[2], { href: '/more', label: 'More', icon: Menu }];
  const moreActive = ['/inventory', '/customers', '/discounts', '/analytics', '/storefront', '/settings', '/more', '/account'].some(h => active(p, h));
  return (
    <nav className="tabbar" aria-label="Main">
      {t.map(({ href, label, icon: I }) => {
        const cur = href === '/more' ? moreActive : active(p, href);
        return <Link key={href} href={href} aria-current={cur ? 'page' : undefined}><I size={20} aria-hidden />{label}</Link>;
      })}
    </nav>
  );
}
