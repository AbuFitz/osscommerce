'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { STRIPE_UK_RATE_CARD as CARD, combinedRate, paymentCost, LAUNCH_PLAN, type PaymentCategory } from '@oss-commerce/contracts';

const BP = LAUNCH_PLAN.fee.baseBp; const OPTS = CARD.rates.filter(r => r.category !== 'klarna');
const gbp = (m: number) => `£${(m / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Eases toward the target so figures glide instead of jumping. */
function useTicker(target: number) {
  const [v, setV] = useState(target); const cur = useRef(target);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { cur.current = target; setV(target); return; }
    let raf = 0; const f = () => { cur.current += (target - cur.current) * 0.22; if (Math.abs(target - cur.current) < 0.5) { cur.current = target; setV(target); return; } setV(Math.round(cur.current)); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
/** Drag an order value, pick how it was paid, read the receipt. Figures come from the same fee model the dashboard uses. */
export function Calculator() {
  const id = useId(); const [amt, setAmt] = useState(60); const [cat, setCat] = useState<PaymentCategory>('uk_standard');
  const c = paymentCost({ amountMinor: amt * 100, category: cat, applicationFeeBp: BP }); const net = useTicker(c.netMinor); const proc = useTicker(c.processingMinor + c.conversionMinor); const app = useTicker(c.applicationMinor);
  return (<div className="calc">
    <div>
      <label htmlFor={`${id}r`} className="mono muted">Customer pays</label>
      <p className="v" aria-hidden>£{amt.toLocaleString('en-GB')}</p>
      <input id={`${id}r`} type="range" min={10} max={1000} step={5} value={amt} onChange={e => setAmt(Number(e.target.value))} style={{ ['--p' as string]: `${((amt - 10) / 990) * 100}%` }} aria-valuetext={`£${amt}`} />
      <fieldset style={{ border: 0, padding: 0, margin: '26px 0 0' }}><legend className="mono muted" style={{ padding: 0 }}>Paid with</legend>
        <div className="opts">{OPTS.map(r => <label key={r.category} data-on={cat === r.category || undefined}><input type="radio" name={`${id}c`} checked={cat === r.category} onChange={() => setCat(r.category)} />{r.label}</label>)}</div></fieldset>
    </div>
    <div className="rc" aria-live="polite"><span className="mono muted">Receipt · {combinedRate(cat, BP).text}</span>
      <dl><div><dt>Customer pays</dt><dd>{gbp(amt * 100)}</dd></div>
        <div className="sub"><dt>Stripe’s processing cost</dt><dd>−{gbp(proc)}</dd></div><div className="sub"><dt>Our fee ({combinedRate(cat, BP).platformText})</dt><dd>−{gbp(app)}</dd></div>
        <div className="tot"><dt>You receive</dt><dd>{gbp(net)}</dd></div></dl>
      <p className="muted" style={{ fontSize: 13, margin: '18px 0 0' }}>Paid out to your bank by Stripe, on Stripe’s schedule.</p></div>
  </div>);
}
