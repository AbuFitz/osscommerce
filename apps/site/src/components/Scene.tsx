'use client';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, Check, Package, TrendingUp } from 'lucide-react';
import { Phone } from './Frames';
import { StoreDemo } from './StoreDemo';
import { Mark } from './Marks';

/**
 * The hero scene: a demo storefront on a phone with pieces of the dashboard floating around it in 3D.
 * The cards are built from HTML (real text, not screenshots) and are an illustration of what the dashboard does.
 * The scene tilts a little with the pointer on devices that have one; it is still under reduced motion.
 */
export function Scene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0; const move = (e: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', String(((e.clientX - r.left) / r.width - .5) * 2)); el.style.setProperty('--my', String(((e.clientY - r.top) / r.height - .5) * 2)); }); };
    const reset = () => { el.style.setProperty('--mx', '0'); el.style.setProperty('--my', '0'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', reset); return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="scene" ref={ref} role="img" aria-label="Illustration: a demo storefront on a phone, surrounded by dashboard cards showing a new order, weekly sales, a payout and stock levels">
      <div className="scene-in" aria-hidden>
        <div className="fc fc-order"><span className="fc-k">New order</span><b>#1042 · Maya Okafor</b><span className="fc-row"><span className="fc-pill"><i />Paid</span><span className="fc-amt">£21.15</span></span><span className="fc-btn">Mark as fulfilled</span></div>
        <div className="fc fc-sales"><span className="fc-k"><TrendingUp size={14} />Sales this week</span><b className="fc-big">£1,319.50</b><span className="fc-bars">{[38, 52, 30, 64, 48, 86, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} data-hi={i === 5 || undefined} />)}</span></div>
        <Phone className="scene-phone"><StoreDemo variant="phone" /></Phone>
        <div className="fc fc-pay"><span className="fc-k">Payout on its way</span><b className="fc-big">£412.80</b><span className="fc-row"><span className="fc-sub">To your bank, Friday</span><Mark k="stripe" mono /></span></div>
        <div className="fc fc-stock"><span className="fc-k"><Package size={14} />Stock</span><span className="fc-line"><span>Bud vase, terracotta</span><b>12</b></span><span className="fc-line"><span>Serving bowl, large</span><b data-low>2</b></span><span className="fc-line"><span>Linen apron</span><b>6</b></span></div>
        <div className="fc fc-done"><Check size={15} /><span>Order #1041 dispatched</span><ArrowUpRight size={14} /></div>
      </div>
    </div>
  );
}
