'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Package, RotateCcw, ShoppingBag, TrendingUp } from 'lucide-react';
import { paymentCost, combinedRate, LAUNCH_PLAN } from '@oss-commerce/contracts';
import { Phone } from './Frames';

const GLAZES = ['Terracotta', 'Chalk', 'Sage'] as const; const PRICE = 2400; const BP = LAUNCH_PLAN.fee.baseBp;
const gbp = (m: number) => `£${(m / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Stage = 'browse' | 'bag' | 'ordered' | 'fulfilled';
const HINT: Record<Stage, string> = { browse: 'Try it: pick a glaze and add the vase to the bag.', bag: 'Now pay for it.', ordered: 'The order has reached the dashboard. Mark it as fulfilled.', fulfilled: 'Done. That is the whole job, from sale to payout.' };

/**
 * The signature of the site: a working sale. The visitor buys from the demo storefront and the order arrives in the dashboard cards,
 * where they fulfil it and see what the payment cost and what they receive. The sums come from the shared fee model, so they match the pricing page.
 * Everything is a real button; state changes are announced. No payment is taken and nothing leaves the page.
 */
export function LiveDemo() {
  const [stage, setStage] = useState<Stage>('browse'); const [glaze, setGlaze] = useState<(typeof GLAZES)[number]>('Terracotta'); const ref = useRef<HTMLDivElement>(null);
  const cost = paymentCost({ amountMinor: PRICE, category: 'uk_standard', applicationFeeBp: BP }); const sold = stage === 'ordered' || stage === 'fulfilled';
  useEffect(() => {
    const el = ref.current; if (!el || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0; const move = (e: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', String(((e.clientX - r.left) / r.width - .5) * 2)); el.style.setProperty('--my', String(((e.clientY - r.top) / r.height - .5) * 2)); }); };
    const reset = () => { el.style.setProperty('--mx', '0'); el.style.setProperty('--my', '0'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', reset); return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="demo" data-stage={stage}>
      <div className="scene" ref={ref}>
        <div className="scene-in">
          <Phone className="scene-phone">
            <div className="sd sd-phone"><div className="sd-in">
              <div className="sd-top"><span className="sd-logo">Kiln &amp; Thread</span><span className="sd-ic"><span className="sd-bag"><ShoppingBag aria-hidden />{stage === 'bag' && <b>1</b>}</span></span></div>
              <div className="sd-body">
                <div className="sd-img"><img src="/img/vases.jpg" alt="Three ceramic vases" /></div>
                <div className="sd-info">
                  {stage === 'browse' && <><b className="sd-title">Bud vase</b><span className="sd-price">{gbp(PRICE)}</span>
                    <div className="sd-opts" role="group" aria-label="Glaze">{GLAZES.map(g => <button key={g} type="button" aria-pressed={g === glaze} onClick={() => setGlaze(g)}>{g}</button>)}</div>
                    <button type="button" className="sd-cta" onClick={() => setStage('bag')}>Add to bag</button></>}
                  {stage === 'bag' && <><span className="sd-lab">Your bag</span><span className="sd-line"><span>Bud vase, {glaze.toLowerCase()}</span><b>{gbp(PRICE)}</b></span><span className="sd-line tot"><span>Total</span><b>{gbp(PRICE)}</b></span>
                    <button type="button" className="sd-cta" onClick={() => setStage('ordered')}>Pay {gbp(PRICE)}</button><span className="sd-note">Demo. No payment is taken.</span></>}
                  {sold && <><span className="sd-ok"><Check aria-hidden /></span><b className="sd-title sm">Thank you</b><span className="sd-note c">Order #1043 confirmed. We have emailed your receipt.</span></>}
                </div>
              </div>
            </div></div>
          </Phone>
          <div className="fc fc-sales" aria-hidden><span className="fc-k"><TrendingUp size={14} />Sales this week</span><b className="fc-big">{gbp(131950 + (sold ? PRICE : 0))}</b><span className="fc-bars">{[38, 52, 30, 64, 48, 70, sold ? 92 : 60].map((h, i) => <i key={i} style={{ height: `${h}%` }} data-hi={i === 6 || undefined} />)}</span></div>
          <div className="fc fc-stock" aria-hidden><span className="fc-k"><Package size={14} />Stock</span><span className="fc-line"><span>Bud vase, {glaze.toLowerCase()}</span><b key={String(sold)} data-flash={sold || undefined}>{sold ? 11 : 12}</b></span><span className="fc-line"><span>Serving bowl, large</span><b data-low>2</b></span></div>
          {sold ? <div className="fc fc-order in"><span className="fc-k">{stage === 'fulfilled' ? 'Fulfilled' : 'New order'}</span><b>#1043 · Bud vase, {glaze.toLowerCase()}</b><span className="fc-row"><span className="fc-pill"><i />Paid</span><span className="fc-amt">{gbp(PRICE)}</span></span>
            {stage === 'ordered' ? <button type="button" className="fc-btn" onClick={() => setStage('fulfilled')}>Mark as fulfilled</button> : <span className="fc-sent"><Check size={14} aria-hidden />Customer emailed</span>}</div>
            : <div className="fc fc-order ghost" aria-hidden><span className="fc-k">Orders</span><b>Waiting for the next one</b></div>}
          {stage === 'fulfilled' && <div className="fc rcpt in"><span className="fc-k">Payment for #1043</span>
            <dl><div><dt>Customer paid</dt><dd>{gbp(cost.grossMinor)}</dd></div><div><dt>Payment cost · {combinedRate('uk_standard', BP).text}</dt><dd>−{gbp(cost.totalFeeMinor)}</dd></div><div className="tot"><dt>You receive</dt><dd>{gbp(cost.netMinor)}</dd></div></dl></div>}
        </div>
      </div>
      <p className="demo-hint" aria-live="polite"><span>{HINT[stage]}</span>{stage !== 'browse' && <button type="button" onClick={() => setStage('browse')}><RotateCcw size={14} aria-hidden />Start again</button>}</p>
    </div>
  );
}
