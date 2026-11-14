'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { NAV, SITE } from '@/config';
import { StartButton } from './Start';

export function SiteHeader() {
  const p = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="hdr">
      <div className="hdr-in">
        <Link href="/" className="word" aria-label={`${SITE.name} ${SITE.product} home`}>{SITE.name}<i>{SITE.product}</i></Link>
        <nav className="nav" aria-label="Main">{NAV.map(n => <Link key={n.href} href={n.href} aria-current={p === n.href ? 'page' : undefined}>{n.label}</Link>)}</nav>
        <span className="cta-d"><StartButton className="btn primary sm">Join the pilot</StartButton></span>
        <button type="button" className="iconbtn menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} aria-hidden /></button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="Menu" style={{ display: 'grid', gap: 6 }} onClick={() => setOpen(false)}>
          {NAV.map(n => <Link key={n.href} href={n.href} style={{ padding: '14px 4px', fontSize: 20, fontWeight: 560, letterSpacing: '-.02em', borderBottom: '1px solid var(--line)' }}>{n.label}</Link>)}
          <Link href="/legal" style={{ padding: '14px 4px', fontSize: 20, fontWeight: 560, letterSpacing: '-.02em' }}>Legal</Link>
        </nav>
        <div onClick={() => setOpen(false)}><StartButton className="btn brand">Join the pilot</StartButton></div>
      </Dialog>
    </header>
  );
}
