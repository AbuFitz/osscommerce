'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NAV, SITE } from '@/config';

export const Wordmark = () => <span className="wm" aria-label="OSS Commerce">oss<b>commerce</b></span>;

export function SiteHeader() {
  const path = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.documentElement.style.overflow = open ? 'hidden' : ''; const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); addEventListener('keydown', esc); return () => { removeEventListener('keydown', esc); document.documentElement.style.overflow = ''; }; }, [open]);
  return (
    <header className="hd" data-open={open}>
      <div className="hd-in">
        <Link href="/" className="hd-wm"><Wordmark /></Link>
        <nav aria-label="Main" className="hd-nav">{NAV.map(n => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>)}</nav>
        <div className="hd-end">
          {SITE.portalUrl && <a className="hd-sign" href={SITE.portalUrl}>Sign in</a>}
          <Link className="btn ink sm" href="/contact">Start a store</Link>
          <button type="button" className="hd-burger" aria-expanded={open} aria-controls="hd-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(o => !o)}>{open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}</button>
        </div>
      </div>
      <div id="hd-menu" className="hd-menu" hidden={!open}>
        <nav aria-label="Menu">{NAV.map(n => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>)}<Link href="/contact">Start a store</Link></nav>
        <p>{SITE.portalUrl ? <a href={SITE.portalUrl}>Merchant sign in</a> : null}<a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
      </div>
    </header>
  );
}
