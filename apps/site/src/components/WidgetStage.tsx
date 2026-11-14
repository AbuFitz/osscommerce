'use client';
import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, Package } from 'lucide-react';

/**
 * The merchant dashboard as a limited, layered view: a handful of real widgets and pop-ups floating at different depths.
 * Built from the portal's own visual language. Desktop: perspective plane with pointer parallax. Mobile: a short overlapped stack.
 */
export function WidgetStage() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current; if (!el || matchMedia('(max-width: 900px)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const mv = (e: PointerEvent) => {
      const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.style.setProperty('--ry', `${-14 + x * 10}deg`); el.style.setProperty('--rx', `${9 - y * 8}deg`); });
    };
    el.addEventListener('pointermove', mv); return () => { el.removeEventListener('pointermove', mv); cancelAnimationFrame(raf); };
  }, []);
  const io = useRef<IntersectionObserver | null>(null);
  useEffect(() => { const el = root.current; if (!el) return; io.current = new IntersectionObserver(([e]) => el.setAttribute('data-play', String(e.isIntersecting)), { threshold: 0.25 }); io.current.observe(el); return () => io.current?.disconnect(); }, []);

  return (
    <div className="wstage" ref={root} data-play="false">
      <div className="wplane">
        <div className="pw dark w-status" style={{ ['--z' as string]: '60px' }}>
          <div className="pw-h"><b>Order status</b><span>24 orders</span></div>
          <div className="dials">{[['17', 'To fulfil', '#e4f55e', 17], ['75', 'Fulfilled', '#b9d3ee', 75], ['8', 'Cancelled', '#e8764a', 8]].map(([n, l, c, p]) => (
            <div className="dial" key={l as string}><b>{n}<small>%</small></b>
              <svg viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth=".6" strokeDasharray="1 2" /><circle cx="16" cy="16" r="11" fill="rgba(255,255,255,.07)" /><circle cx="16" cy="16" r="6.25" fill="none" stroke={c as string} strokeWidth="12.5" strokeDasharray={`${(p as number) / 100 * 19.6} 40`} transform="rotate(-90 16 16)" /></svg>
              <span>{l}</span></div>))}</div>
        </div>

        <div className="pw yellow w-sales" style={{ ['--z' as string]: '20px' }}>
          <div className="pw-h"><b>Net sales</b><span>After refunds</span></div>
          <div className="pw-big">£1,319.50</div>
          <svg viewBox="0 0 280 90" className="pw-bars" aria-hidden><defs><pattern id="ws-d" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="rgba(60,45,0,.45)" /></pattern><pattern id="ws-k" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="rgba(30,20,0,.85)" /></pattern></defs>
            {[28, 46, 34, 58, 40, 66, 52, 78, 60, 86].map((h, i) => <g key={i}><rect x={i * 28 + 2} y={90 - h} width={20} height={h} rx={4} fill={i === 9 ? 'url(#ws-k)' : 'url(#ws-d)'} /></g>)}</svg>
        </div>

        <div className="pw w-list" style={{ ['--z' as string]: '90px' }}>
          <div className="pw-h"><b>To fulfil</b><span>4</span></div>
          {[['#1043', 'Maya O.', '£42.00'], ['#1042', 'Tom H.', '£68.00'], ['#1041', 'Priya N.', '£126.00']].map(([n, w, a], i) => (
            <div className="pw-row" key={n} style={{ ['--i' as string]: i }}><span className="av">{(w as string)[0]}</span><span><b>{n}</b><small>{w}</small></span><em>{a}</em></div>))}
        </div>

        <div className="pw w-toggle" style={{ ['--z' as string]: '110px' }}>
          <div className="tg"><div><b>Low stock alerts</b><small>Email me at the alert level</small></div><span className="sw" aria-hidden><i /></span></div>
        </div>

        <div className="pw glass-w w-toast" style={{ ['--z' as string]: '150px' }}>
          <span className="ok"><Package size={16} aria-hidden /></span><div><b>New order · #1043</b><small>£42.00 · Paid to your Stripe account</small></div>
        </div>

        <div className="pw glass-w w-dialog" style={{ ['--z' as string]: '190px' }}>
          <div className="pw-h"><b>Refund order #1042</b><span aria-hidden>×</span></div>
          <p>£21.15 can still be refunded to the customer&rsquo;s card.</p>
          <div className="note"><AlertTriangle size={13} aria-hidden /> We show Pending until Stripe confirms.</div>
          <div className="btns"><span>Cancel</span><span className="go">Refund £21.15</span></div>
        </div>
        <div className="pw glass-w w-ok" style={{ ['--z' as string]: '210px' }}><span className="ok"><Check size={16} aria-hidden /></span><div><b>Refund confirmed</b><small>Receipt sent</small></div></div>
      </div>
    </div>
  );
}
