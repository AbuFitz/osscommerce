'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { SITE } from '@/config';
import { Wordmark } from './Brand';
import { PRODUCT, LINKS } from './nav';

export function Header() {
  const path = usePathname(); const [menu, setMenu] = useState(false); const [prod, setProd] = useState(false); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setMenu(false); setProd(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = menu ? 'hidden' : '';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setProd(false); } }; const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setProd(false); };
    addEventListener('keydown', esc); addEventListener('mousedown', away); return () => { removeEventListener('keydown', esc); removeEventListener('mousedown', away); document.documentElement.style.overflow = ''; };
  }, [menu]);
  return (
    <header className="hd"><div className="hd-in" ref={box}>
      <Link href="/" aria-label="OneSimpleCommerce home"><Wordmark /></Link>
      <nav aria-label="Main" className="hd-nav">
        <button type="button" aria-expanded={prod} aria-controls="mega" onClick={() => setProd(p => !p)}>Product</button>
        {LINKS.map(n => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>)}
      </nav>
      <div className="hd-end">
        {SITE.portalUrl && <a className="hd-sign" href={SITE.portalUrl}>Log in</a>}
        <Link className="btn sml go" href="/start">Start your store</Link>
        <button type="button" className="hd-burger" aria-expanded={menu} aria-controls="hd-menu" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(o => !o)}>{menu ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}</button>
      </div>
      <div id="mega" className="mega" hidden={!prod}><div className="mega-g">{PRODUCT.map(p => <Link key={p.href} href={p.href} aria-current={path === p.href ? 'page' : undefined}><b>{p.label}</b><span>{p.note}</span></Link>)}</div></div>
      <div id="hd-menu" className="hd-menu" hidden={!menu}>
        {[...PRODUCT, ...LINKS].map(n => <Link key={n.href} className="big" href={n.href}>{n.label}</Link>)}<Link className="big" href="/start">Start your store</Link>
        <p>{SITE.portalUrl ? <a href={SITE.portalUrl}>Merchant log in</a> : null}<a href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
      </div>
    </div></header>
  );
}
