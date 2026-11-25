'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, CreditCard, LayoutDashboard, Plug, Wrench } from 'lucide-react';
import { SITE } from '@/config';
import { LINKS, PRODUCT } from './nav';
import { Wordmark } from './Brand';
import { ThemeToggle } from './ThemeToggle';

const ICON = { dashboard: LayoutDashboard, card: CreditCard, wrench: Wrench, plug: Plug } as const;
const spring = { type: 'spring', bounce: 0.15, duration: 0.3 } as const;

/** A floating glass pill. The highlight glides between links, the product menu rises out of the bar on a spring, and on phones it becomes a sheet. */
export function Header() {
  const path = usePathname(); const [hover, setHover] = useState<string | null>(null); const [menu, setMenu] = useState(false); const [mobile, setMobile] = useState(false); const [scrolled, setScrolled] = useState(false);
  const bar = useRef<HTMLElement>(null); const byHover = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openMenu = useCallback(() => { clearTimeout(timer.current); setMenu(true); }, []);
  const closeMenu = useCallback((wait = 140) => { clearTimeout(timer.current); timer.current = setTimeout(() => setMenu(false), wait); }, []);
  useEffect(() => { setMenu(false); setMobile(false); }, [path]);
  useEffect(() => { const f = () => setScrolled(scrollY > 10); f(); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f); }, []);
  useEffect(() => {
    if (!menu && !mobile) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setMobile(false); } };
    const down = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) { setMenu(false); setMobile(false); } };
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', down); return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); };
  }, [menu, mobile]);
  useEffect(() => { document.body.style.overflow = mobile ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [mobile]);
  const here = (h: string) => path === h || path.startsWith(h + '/');
  const productActive = PRODUCT.some(p => here(p.href));
  return (
    <div className="nav-wrap">
      <header className="nav" ref={bar} data-scrolled={scrolled} onPointerLeave={() => setHover(null)}>
        <Link href="/" aria-label={`${SITE.name} home`}><Wordmark /></Link>
        <nav aria-label="Main"><ul className="links">
          <li onPointerEnter={e => { setHover('product'); if (e.pointerType === 'mouse') { byHover.current = true; openMenu(); } }} onPointerLeave={e => { if (e.pointerType === 'mouse') { byHover.current = false; closeMenu(); } }}>
            <button type="button" className="lk" aria-expanded={menu} aria-haspopup="true" aria-current={productActive ? 'page' : undefined} onClick={() => { if (byHover.current) { byHover.current = false; openMenu(); } else setMenu(m => !m); }} onFocus={() => setHover('product')}>
              {hover === 'product' && <motion.i layoutId="hl" className="hl" transition={spring} />}<span>Product</span><ChevronDown className="chev" size={15} aria-hidden />
            </button>
          </li>
          {LINKS.map(l => (<li key={l.href} onPointerEnter={() => { setHover(l.href); closeMenu(60); }}>
            <Link href={l.href} className="lk" aria-current={here(l.href) ? 'page' : undefined} onFocus={() => setHover(l.href)}>{hover === l.href && <motion.i layoutId="hl" className="hl" transition={spring} />}<span>{l.label}</span></Link></li>))}
        </ul></nav>
        <div className="nav-r">
          <div className="toggle-wrap hide-m"><ThemeToggle /></div>
          {SITE.portalUrl && <a className="btn sml hide-m" href={SITE.portalUrl}>Sign in</a>}
          <Link className="btn sml pri hide-m" href="/start">Start your store <ArrowRight size={15} aria-hidden /></Link>
          <button type="button" className="burger" aria-expanded={mobile} aria-label={mobile ? 'Close menu' : 'Open menu'} onClick={() => setMobile(m => !m)}><i /></button>
        </div>
        <AnimatePresence>{menu && (
          <motion.div className="menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={spring} onPointerEnter={openMenu} onPointerLeave={e => { if (e.pointerType === 'mouse') closeMenu(); }}>
            <ul>{PRODUCT.map((p, i) => { const I = ICON[p.icon]; return (<motion.li key={p.href} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.03 * i }}>
              <Link href={p.href} className="mi"><span className="ic"><I size={19} aria-hidden /></span><span><b>{p.label}</b><span>{p.note}</span></span></Link></motion.li>); })}</ul>
          </motion.div>)}</AnimatePresence>
        <AnimatePresence>{mobile && (
          <motion.div className="sheet" initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}>
            <p className="grp">Product</p>
            {PRODUCT.map((p, i) => (<motion.div key={p.href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i, ...spring }}><Link className="row" href={p.href}>{p.label}<ArrowRight size={17} aria-hidden /></Link></motion.div>))}
            <p className="grp">Company</p>
            {LINKS.map(l => (<Link key={l.href} className="row" href={l.href}>{l.label}<ArrowRight size={17} aria-hidden /></Link>))}
            <div className="cta"><Link className="btn pri" href="/start">Start your store</Link>{SITE.portalUrl && <a className="btn" href={SITE.portalUrl}>Sign in</a>}<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 6px 0' }}><span className="muted">Dark mode</span><ThemeToggle /></div></div>
          </motion.div>)}</AnimatePresence>
      </header>
    </div>
  );
}
