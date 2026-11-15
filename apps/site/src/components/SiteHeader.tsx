'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { SITE } from '@/config';
import { FEATURES } from '@/content/features';

/** onesimplecommerce. Each letter of "simple" lifts in turn on hover. */
export function Wordmark() {
  return (<span className="wm" aria-label="OneSimpleCommerce"><span aria-hidden>one</span><b aria-hidden>{'simple'.split('').map((c, i) => <i key={i} style={{ ['--i' as string]: i }}>{c}</i>)}</b><span aria-hidden>commerce</span><em aria-hidden>.</em></span>);
}
const LINKS = [{ href: '/how-it-works', label: 'How it works' }, { href: '/pricing', label: 'Pricing' }];
const groups = (['Sell', 'Manage'] as const).map(g => ({ g, items: FEATURES.filter(f => f.group === g) }));

export function SiteHeader() {
  const path = usePathname(); const [menu, setMenu] = useState(false); const [prod, setProd] = useState(false); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setMenu(false); setProd(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = menu ? 'hidden' : '';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setProd(false); } }; const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setProd(false); };
    addEventListener('keydown', esc); addEventListener('mousedown', away); return () => { removeEventListener('keydown', esc); removeEventListener('mousedown', away); document.documentElement.style.overflow = ''; };
  }, [menu]);
  const mega = (<div className="mega-in">{groups.map(({ g, items }) => <div key={g}><p className="mono">{g}</p><ul>{items.map(f => <li key={f.slug}><Link href={`/features/${f.slug}`} aria-current={path === `/features/${f.slug}` ? 'page' : undefined}><b>{f.nav}</b><span>{f.blurb}</span></Link></li>)}</ul></div>)}
    <div className="mega-all"><Link href="/platform">The whole platform</Link></div></div>);
  return (
    <header className="hd">
      <div className="hd-in" ref={box}>
        <Link href="/" className="hd-wm"><Wordmark /></Link>
        <nav aria-label="Main" className="hd-nav">
          <button type="button" aria-expanded={prod} aria-controls="mega" onClick={() => setProd(p => !p)}>Product <ChevronDown size={15} aria-hidden /></button>
          {LINKS.map(n => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>)}
        </nav>
        <div className="hd-end">
          {SITE.portalUrl && <a className="hd-sign" href={SITE.portalUrl}>Log in</a>}
          <Link className="btn ink sm" href="/start">Start your store</Link>
          <button type="button" className="hd-burger" aria-expanded={menu} aria-controls="hd-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(o => !o)}>{menu ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}</button>
        </div>
        <div id="mega" className="mega" hidden={!prod}>{mega}</div>
      </div>
      <div id="hd-menu" className="hd-menu" hidden={!menu}>
        {mega}
        <nav aria-label="More">{LINKS.map(n => <Link key={n.href} href={n.href}>{n.label}</Link>)}<Link href="/start">Start your store</Link></nav>
        <p>{SITE.portalUrl ? <a href={SITE.portalUrl}>Merchant log in</a> : null}<a href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
      </div>
    </header>
  );
}
