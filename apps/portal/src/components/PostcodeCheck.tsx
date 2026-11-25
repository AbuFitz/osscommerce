'use client';
import { useId, useState } from 'react';
import { MapPin, CircleCheck, CircleAlert } from 'lucide-react';
import { zoneForPostcode } from '@oss-commerce/contracts';
import type { ShippingZone } from '@/lib/gateway';
import { money } from '@/lib/format';
import { describeWhen, offeredRates } from '@/lib/delivery';

/** Answers "do I deliver here, and for how much?" from the merchant's own zones. Runs in the browser, sends the postcode nowhere. */
export function PostcodeCheck({ zones }: { zones: ShippingZone[] }) {
  const id = useId(); const [v, setV] = useState(''); const [done, setDone] = useState(''); const [total, setTotal] = useState(''); const [kg, setKg] = useState('');
  const basket = Math.round(Number(total || 0) * 100) || 0; const weight = Math.round(Number(kg || 0) * 1000) || 0; const r = done ? zoneForPostcode(done, zones) : null;
  return (<section className="w c-8" aria-labelledby={`${id}t`}>
    <h2 id={`${id}t`} style={{ marginBottom: 4 }}>Check a postcode</h2>
    <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>See which zone and options a customer gets. Add an order total and weight to try your value and weight rules. Nothing is sent anywhere.</p>
    <form className="pcheck" onSubmit={e => { e.preventDefault(); setDone(v.trim()); }}>
      <div className="field"><label className="sr" htmlFor={`${id}i`}>Postcode</label><div className="adorn"><span aria-hidden><MapPin size={16} /></span><input id={`${id}i`} value={v} placeholder="e.g. IV2 3AB" autoComplete="off" onChange={e => setV(e.target.value)} /></div></div>
      <div className="field"><label className="sr" htmlFor={`${id}o`}>Order total in pounds</label><div className="adorn"><span aria-hidden>£</span><input id={`${id}o`} inputMode="decimal" placeholder="Order total" value={total} onChange={e => setTotal(e.target.value)} /></div></div>
      <div className="field"><label className="sr" htmlFor={`${id}k`}>Order weight in kilograms</label><input id={`${id}k`} inputMode="decimal" placeholder="Weight (kg)" value={kg} onChange={e => setKg(e.target.value)} /></div>
      <button className="btn primary" type="submit">Check</button>
    </form>
    <div aria-live="polite" className="pres">{r && (r.invalid ? <p className="pbad"><CircleAlert size={16} aria-hidden />That does not look like a UK postcode.</p>
      : !r.zone ? <p className="pbad"><CircleAlert size={16} aria-hidden /><span><b>No delivery here.</b> None of your zones cover {done.toUpperCase()}. Add a zone that lists its postcode area.</span></p>
      : <div className="pok"><p><CircleCheck size={16} aria-hidden /><span><b>{r.zone.name}</b>{r.via === 'fallback' ? ' covers this by default (it is not listed by postcode).' : ' lists this postcode area.'}</span></p>
        {(() => { const o = offeredRates(r.zone.rates, { basketMinor: basket, weightGrams: weight }); return o.length ? <ul>{o.map(x => <li key={x.label}><span>{x.label}</span><b>{x.priceMinor === 0 ? 'Free' : money(x.priceMinor)}</b></li>)}</ul> : <p className="pbad"><CircleAlert size={16} aria-hidden />No option fits an order like this ({[total && `£${total}`, kg && `${kg} kg`].filter(Boolean).join(', ') || 'empty'}). Add one that does.</p>; })()}</div>)}</div>
  </section>);
}
