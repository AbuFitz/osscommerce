'use client';
import { useId, useState } from 'react';
import { STRIPE_UK_RATE_CARD as CARD, combinedRate, paymentCost, LAUNCH_PLAN, type PaymentCategory } from '@oss-commerce/contracts';
const gbp = (m: number) => `£${(m / 100).toFixed(2)}`; const BP = LAUNCH_PLAN.fee.baseBp; const OPTS = CARD.rates.filter(r => r.category !== 'klarna');
/** Type an order value, pick how it was paid, read the receipt. Uses the same fee model as the dashboard. */
export function PayCalc() {
  const id = useId(); const [amt, setAmt] = useState('50'); const [cat, setCat] = useState<PaymentCategory>('uk_standard');
  const n = Number(amt); const ok = /^\d+(\.\d{1,2})?$/.test(amt) && n >= 1 && n <= 100000; const c = ok ? paymentCost({ amountMinor: Math.round(n * 100), category: cat, applicationFeeBp: BP }) : null;
  return (<div className="calc">
    <form className="calc-in" onSubmit={e => e.preventDefault()}>
      <div className="fld"><label htmlFor={`${id}a`}>Order value</label><div className="adorn"><span aria-hidden>£</span><input id={`${id}a`} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={!ok} aria-describedby={ok ? undefined : `${id}e`} /></div>{!ok && <small id={`${id}e`} className="err">Enter an amount between £1 and £100,000.</small>}</div>
      <fieldset className="fld chips"><legend>Paid with</legend><div>{OPTS.map(r => <label key={r.category} data-on={cat === r.category || undefined}><input type="radio" name={`${id}c`} checked={cat === r.category} onChange={() => setCat(r.category)} />{r.label}</label>)}</div></fieldset>
    </form>
    <div className="rcpt big" aria-live="polite"><span className="fc-k">Receipt</span>
      {c ? <dl><div><dt>Customer pays</dt><dd>{gbp(c.grossMinor)}</dd></div><div><dt>Payment cost · {combinedRate(cat, BP).text}</dt><dd>−{gbp(c.totalFeeMinor)}</dd></div><div className="sub"><dt>Card processing</dt><dd>{gbp(c.processingMinor)}</dd></div><div className="sub"><dt>Platform fee ({BP / 100}%)</dt><dd>{gbp(c.applicationMinor)}</dd></div><div className="tot"><dt>You receive</dt><dd>{gbp(c.netMinor)}</dd></div></dl> : <p>Enter an order value to see the sums.</p>}</div>
  </div>);
}
