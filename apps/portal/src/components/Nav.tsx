'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { commerce, GROUPS, SETTINGS, HELP, type NavItem } from './nav-data';
import { ProfileMenu } from './ProfileMenu';

const active = (p: string, h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(h + '/'));

/** Frame + rail. Owns the expanded state so the grid column can animate; the preference lives in a cookie so the server renders it without a flash. */
export function Shell({ children, initials, name, role, hidden = [], defaultExpanded }: {
  children: React.ReactNode; initials: string; name: string; role: string; hidden?: string[]; defaultExpanded: boolean;
}) {
  const [pref, setOpen] = useState(defaultExpanded);
  // On narrower desktop windows the labelled rail would squeeze the page, so it folds to icons there (the saved preference is kept).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const m = window.matchMedia('(max-width:1099px)'); const f = () => setNarrow(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const open = pref && !narrow;
  const p = usePathname();
  const toggle = () => { const v = !pref; setOpen(v); document.cookie = `oss_rail=${v ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`; };
  const item = (it: NavItem) => (
    <Link key={it.href} href={it.href} data-label={it.label} title={open ? undefined : it.label} aria-label={open ? undefined : it.label} aria-current={active(p, it.href) ? 'page' : undefined}>
      <it.icon size={19} aria-hidden /><span className="lbl">{it.label}</span>
    </Link>
  );
  return (
    <div className="frame" data-rail={open ? 'open' : 'closed'}>
      <aside className="rail">
        <nav aria-label="Main" className="rail-nav">
          {GROUPS.map((g, i) => { const items = g.items.filter(x => !hidden.includes(x.href)); if (!items.length) return null; return (
            <div key={i} className="rail-grp">{g.label && <div className="rail-cap" aria-hidden={!open}>{g.label}</div>}{items.map(item)}</div>); })}
        </nav>
        <div className="grow" />
        <div className="rail-grp rail-end">{item(HELP)}{item(SETTINGS)}</div>
        <ProfileMenu initials={initials} name={name} role={role} open={open} />
        <button type="button" className="rail-toggle" onClick={toggle} aria-expanded={open} aria-label={open ? 'Collapse menu' : 'Expand menu'} data-label={open ? 'Collapse menu' : 'Expand menu'}>
          {open ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}<span className="lbl">Collapse</span>
        </button>
      </aside>
      {children}
    </div>
  );
}

export function TabBar() {
  const p = usePathname();
  const t = [commerce[0], commerce[1], commerce[2], { href: '/more', label: 'More', icon: Menu }];
  const moreActive = ['/collections', '/inventory', '/customers', '/discounts', '/analytics', '/automations', '/storefront', '/content', '/support', '/settings', '/more', '/account'].some(h => active(p, h));
  return (
    <nav className="tabbar" aria-label="Main">
      {t.map(({ href, label, icon: I }) => {
        const cur = href === '/more' ? moreActive : active(p, href);
        return <Link key={href} href={href} aria-current={cur ? 'page' : undefined}><I size={20} aria-hidden />{label}</Link>;
      })}
    </nav>
  );
}
