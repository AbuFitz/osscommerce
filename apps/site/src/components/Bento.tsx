'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, QrCode } from 'lucide-react';

const COLORS = ['#d4f26a', '#0f5a3f', '#1fa774', '#f2eee5', '#d49a1b'];
/** Mark an order as fulfilled, right here. A real button: the status flips, a burst of confetti plays unless motion is reduced. */
export function FulfilDemo() {
  const [done, setDone] = useState(false); const [burst, setBurst] = useState(false); const reduce = useRef(false);
  useEffect(() => { reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches; }, []);
  const go = () => { setDone(d => !d); if (!done && !reduce.current) { setBurst(false); requestAnimationFrame(() => setBurst(true)); setTimeout(() => setBurst(false), 1200); } };
  return (<div className="vis"><div className="ord" data-done={done || undefined} data-burst={burst || undefined}>
    <div className="r"><b>Order #2041</b><span className="st"><i />{done ? 'Fulfilled' : 'To fulfil'}</span></div>
    <div className="r" style={{ color: '#6a736e' }}><span>2 items · Hannah Cole, Bristol</span><span className="num" style={{ color: '#0b0e0d', fontSize: 20 }}>£64.00</span></div>
    <button type="button" className="mk" data-done={done || undefined} onClick={go} aria-pressed={done}>{done ? <><Check size={18} aria-hidden />Fulfilled. Customer emailed</> : 'Mark as fulfilled'}</button>
    <div className="cf" aria-hidden>{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ ['--c' as string]: COLORS[i % 5], ['--d' as string]: i, ['--x' as string]: `${(i % 2 ? 1 : -1) * (20 + ((i * 37) % 150))}px`, ['--y' as string]: `${-80 - ((i * 53) % 130)}px`, ['--r' as string]: `${(i * 97) % 360}deg` } as React.CSSProperties} />)}</div>
  </div></div>);
}
/** Sales climbing as the card scrolls into view. */
export function SalesBars() {
  const ref = useRef<HTMLDivElement>(null); const [inView, setIn] = useState(false); const [total, setTotal] = useState(0); const H = [.34, .5, .4, .62, .52, .74, .66, 1];
  useEffect(() => { const el = ref.current; if (!el) return; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect(); } }, { threshold: .4 }); io.observe(el); return () => io.disconnect(); }, []);
  useEffect(() => { if (!inView) return; if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTotal(1840); return; } const t0 = performance.now(); let raf = 0; const f = (t: number) => { const p = Math.min((t - t0) / 1400, 1); setTotal(Math.round(1840 * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, [inView]);
  return (<div className="vis" ref={ref}><p className="mono" style={{ opacity: .6 }}>Today</p><p className="num" style={{ fontSize: 'clamp(40px,5vw,62px)', margin: '6px 0 18px' }}>£{total.toLocaleString('en-GB')}</p>
    <div className="bars" data-in={inView || undefined} aria-hidden>{H.map((h, i) => <i key={i} className={i === H.length - 1 ? 'hi' : ''} style={{ ['--h' as string]: h, ['--i' as string]: i } as React.CSSProperties} />)}</div></div>);
}
/** A phone scanning a product and the product appearing on the shop. */
export function ScanDemo() {
  return (<div className="vis scan" role="img" aria-label="A phone camera scanning a product, which then appears in the shop"><div className="ph" aria-hidden><QrCode size={30} color="#d4f26a" style={{ margin: '42% auto 0', opacity: .9 }} /></div><div className="pr" aria-hidden><b>New: Fig &amp; cedar candle</b><span style={{ color: '#6a736e' }}>Added to Candles · £26</span></div></div>);
}
