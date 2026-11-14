'use client';
import { useState } from 'react';
import { Toggle } from '@oss-commerce/ui';
import { PRICING } from '@/config';

const gbp = (n: number, dp = 2) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: n % 1 ? dp : 0, maximumFractionDigits: dp }).format(n);

/** Plans come from config (and, later, the internal platform). Nothing here is hardcoded per page. */
export function PricingTable() {
  const [vat, setVat] = useState(false);
  const k = vat ? 1 + PRICING.vatRate : 1;
  const [a, b] = PRICING.plans;
  return (
    <div>
      <Toggle label="Show prices including VAT" description="Prices are quoted excluding VAT." checked={vat} onChange={setVat} />
      <div className="plans" role="table" aria-label="Plans">
        <div className="hd row-h" role="columnheader" />
        {PRICING.plans.map(p => <div key={p.id} className="hd pl" role="columnheader">{p.name}</div>)}

        <div className="k row-h" role="rowheader">Monthly</div>
        {PRICING.plans.map(p => <div key={p.id} className="pl" role="cell"><div className="lab-m">Monthly</div><div className="big num">{gbp(p.monthly * k)}<small> / month</small></div></div>)}

        <div className="k row-h" role="rowheader">Storefront build</div>
        {PRICING.plans.map(p => <div key={p.id} className="pl" role="cell"><div className="lab-m">Custom storefront build</div><div className="big num" style={{ fontSize: 'clamp(30px,3.2vw,46px)' }}>from {gbp(p.buildFrom * k, 0)}<small> one-off</small></div></div>)}

        <div className="k row-h" role="rowheader">Transaction fee</div>
        {PRICING.plans.map(p => <div key={p.id} className="pl" role="cell"><div className="lab-m">Transaction fee</div><div style={{ fontWeight: 600 }}>{p.commissionBp ? `${(p.commissionBp / 100).toFixed(1)}%` : 'Reduced rate'}</div><div className="muted">{p.commissionNote}</div></div>)}

        <div className="k row-h" role="rowheader">Included</div>
        {PRICING.plans.map(p => <div key={p.id} className="pl" role="cell"><div className="lab-m">Included</div><ul>{p.includes.map(x => <li key={x}>{x}</li>)}</ul></div>)}
      </div>
      <p className="muted" style={{ marginTop: 18, fontSize: 14 }}>Starting prices for the pilot. Final prices, inclusions and fees are confirmed in your order form.</p>
      <span className="sr">{a.name} and {b.name}</span>
    </div>
  );
}

export function FeeExample() {
  const [sales, setSales] = useState(3000);
  const bp = PRICING.plans[0].commissionBp ?? 0;
  const fee = sales * (bp / 10000);
  return (
    <div className="glass-l fee">
      <div><label htmlFor="fx" style={{ fontWeight: 600 }}>Monthly sales through your shop</label>
        <input id="fx" type="range" min={0} max={30000} step={250} value={sales} onChange={e => setSales(+e.target.value)} aria-valuetext={gbp(sales, 0)} />
        <div className="muted" style={{ fontSize: 14 }}>{gbp(sales, 0)} in sales. Payment processing fees are charged by Stripe and are separate.</div></div>
      <div style={{ textAlign: 'right' }}><div className="muted" style={{ fontSize: 14 }}>OSS transaction fee ({(bp / 100).toFixed(1)}%)</div><div className="out num">{gbp(fee)}</div></div>
    </div>
  );
}
