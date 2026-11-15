'use client';
import { useId, useState } from 'react';
import { MapPin, CircleCheck, CircleAlert } from 'lucide-react';
import { zoneForPostcode } from '@oss-commerce/contracts';
import type { ShippingZone } from '@/lib/gateway';
import { money } from '@/lib/format';

/** Answers "do I deliver here, and for how much?" from the merchant's own zones. Runs in the browser, sends the postcode nowhere. */
export function PostcodeCheck({ zones }: { zones: ShippingZone[] }) {
  const id = useId(); const [v, setV] = useState(''); const [done, setDone] = useState(''); const r = done ? zoneForPostcode(done, zones) : null;
  return (<section className="w c-8" aria-labelledby={`${id}t`}>
    <h2 id={`${id}t`} style={{ marginBottom: 4 }}>Check a postcode</h2>
    <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>See which zone and prices a customer gets. Nothing is sent anywhere; it uses the zones above.</p>
    <form className="pcheck" onSubmit={e => { e.preventDefault(); setDone(v.trim()); }}>
      <div className="field"><label className="sr" htmlFor={`${id}i`}>Postcode</label><div className="adorn"><span aria-hidden><MapPin size={16} /></span><input id={`${id}i`} value={v} placeholder="e.g. IV2 3AB" autoComplete="off" onChange={e => setV(e.target.value)} /></div></div>
      <button className="btn primary" type="submit">Check</button>
    </form>
    <div aria-live="polite" className="pres">{r && (r.invalid ? <p className="pbad"><CircleAlert size={16} aria-hidden />That does not look like a UK postcode.</p>
      : !r.zone ? <p className="pbad"><CircleAlert size={16} aria-hidden /><span><b>No delivery here.</b> None of your zones cover {done.toUpperCase()}. Add a zone that lists its postcode area.</span></p>
      : <div className="pok"><p><CircleCheck size={16} aria-hidden /><span><b>{r.zone.name}</b>{r.via === 'fallback' ? ' covers this by default (it is not listed by postcode).' : ' lists this postcode area.'}</span></p>
        <ul>{r.zone.rates.map(x => <li key={x.label}><span>{x.label}</span><b>{money(x.priceMinor)}{x.freeOverMinor ? <small> free over {money(x.freeOverMinor)}</small> : null}</b></li>)}</ul></div>)}</div>
  </section>);
}
