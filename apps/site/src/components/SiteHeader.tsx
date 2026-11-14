'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { NAV } from '@/config';
import { StartButton } from './Start';
import { Wordmark } from './Wordmark';

export function SiteHeader() {
  const p = usePathname();
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState(false);
  useEffect(() => { const f = () => setDock(scrollY > innerHeight * 0.7); f(); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f); }, []);
  return (
    <>
      <header className="hdr">
        <div className="hdr-in">
          <Link href="/" aria-label="OneSimpleSite Commerce home"><Wordmark /></Link>
          <nav className="nav" aria-label="Main">{NAV.map(n => <Link key={n.href} href={n.href} aria-current={p === n.href ? 'page' : undefined}>{n.label}</Link>)}</nav>
          <span className="cta-d"><StartButton className="btn white sm">Start your store</StartButton></span>
          <button type="button" className="iconbtn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} aria-hidden /></button>
        </div>
        <Dialog open={open} onClose={() => setOpen(false)} title="Menu">
          <nav aria-label="Menu" style={{ display: 'grid' }} onClick={() => setOpen(false)}>
            {NAV.map(n => <Link key={n.href} href={n.href} style={{ padding: '16px 2px', fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', fontFamily: 'var(--f-display)', borderBottom: '1px solid var(--line-l)' }}>{n.label}</Link>)}
            <Link href="/legal" style={{ padding: '16px 2px', fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', fontFamily: 'var(--f-display)' }}>Legal</Link>
          </nav>
          <div onClick={() => setOpen(false)}><StartButton>Start your store</StartButton></div>
        </Dialog>
      </header>
      <div className="dock" data-show={dock} aria-hidden={!dock}><StartButton className="btn solid">Start your store</StartButton></div>
    </>
  );
}
