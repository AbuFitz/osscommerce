'use client';
import { useEffect, useId, useState } from 'react';
import { MapPin, Wrench, Truck, Sparkles } from 'lucide-react';
import { parsePostcode } from '@oss-commerce/contracts';

/** Postcode eligibility: fitting is offered inside the business's radius, delivery everywhere. The rule is a stand-in set of outward-code areas. */
const FIT = new Set(['WD', 'HA', 'NW', 'EN', 'AL', 'UB', 'HP']);
export function FittingDemo() {
  const id = useId(); const [v, setV] = useState('WD24 6SX'); const p = v.trim() ? parsePostcode(v) : null; const near = !!p && FIT.has(p.area);
  return (<div className="wg"><span className="k">Dashcam · £149</span>
    <div><label htmlFor={id} style={{ fontWeight: 650, fontSize: 15 }}>Your postcode</label><div style={{ position: 'relative', marginTop: 8 }}><MapPin size={18} aria-hidden style={{ position: 'absolute', left: 14, top: 18, color: '#6a736e' }} /><input id={id} type="text" value={v} onChange={e => setV(e.target.value)} autoComplete="off" style={{ paddingLeft: 42 }} aria-describedby={`${id}r`} /></div></div>
    <div id={`${id}r`} aria-live="polite">{!v.trim() ? <div className="res no">Enter a postcode to see your options.</div> : !p ? <div className="res bad">That does not look like a UK postcode.</div> : near
      ? <div className="res ok"><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Wrench size={17} aria-hidden />Professional fitting available</b><span>We can fit this at your address. Choose a slot at checkout (+£45).</span></div>
      : <div className="res no"><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Truck size={17} aria-hidden />Delivery only</b><span>Fitting is not offered in your area, so this ships to you with a fitting guide.</span></div>}</div>
    <span className="k">The coverage area, prices and slots are the merchant&rsquo;s own.</span></div>);
}
const NOTES = ['Fig', 'Cedar', 'Sea salt', 'Vanilla', 'Bergamot'] as const; const SIZES = [['Travel tin', 14], ['Classic jar', 26], ['Large jar', 38]] as const;
export function PersonaliseDemo() {
  const [notes, setNotes] = useState<string[]>(['Fig', 'Cedar']); const [size, setSize] = useState<number>(1); const [label, setLabel] = useState('For Amara');
  const tog = (n: string) => setNotes(a => a.includes(n) ? a.filter(x => x !== n) : a.length < 3 ? [...a, n] : a); const price = SIZES[size][1] + (label.trim() ? 4 : 0);
  return (<div className="wg"><span className="k">Create your candle</span>
    <div><b style={{ fontSize: 15 }}>Scent notes <span style={{ color: '#6a736e', fontWeight: 400 }}>(up to three)</span></b><div className="op" role="group" aria-label="Scent notes" style={{ marginTop: 8 }}>{NOTES.map(n => <label key={n} data-on={notes.includes(n) || undefined}><input type="checkbox" checked={notes.includes(n)} onChange={() => tog(n)} />{n}</label>)}</div></div>
    <div><b style={{ fontSize: 15 }}>Size</b><div className="op" role="radiogroup" aria-label="Size" style={{ marginTop: 8 }}>{SIZES.map(([n, p], i) => <label key={n} data-on={size === i || undefined}><input type="radio" name="size" checked={size === i} onChange={() => setSize(i)} />{n} · £{p}</label>)}</div></div>
    <div><label htmlFor="lab" style={{ fontWeight: 650, fontSize: 15 }}>Label message</label><input id="lab" type="text" value={label} maxLength={24} onChange={e => setLabel(e.target.value)} style={{ marginTop: 8, textTransform: 'none' }} /></div>
    <div className="res ok" aria-live="polite"><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Sparkles size={17} aria-hidden />{notes.length ? notes.join(' + ') : 'Choose a note'} · {SIZES[size][0].toLowerCase()}</b><span>{label.trim() ? `Label: “${label.trim()}”. ` : ''}Made to order. <b>£{price}</b></span></div></div>);
}
/** A free-delivery window after an order. Counts down for real; resets when it ends. */
export function WindowDemo() {
  const TOTAL = 8 * 3600; const [left, setLeft] = useState(TOTAL - 2 * 3600 - 14 * 60);
  useEffect(() => { const t = setInterval(() => setLeft(s => (s <= 1 ? TOTAL : s - 1)), 1000); return () => clearInterval(t); }, [TOTAL]);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60; const pad = (n: number) => String(n).padStart(2, '0');
  return (<div className="wg"><span className="k">Your order #4410 is in</span>
    <div className="res ok"><b style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Truck size={17} aria-hidden />Free delivery on anything you add</b><span>Your delivery is waived on further orders for the next</span><span className="num" style={{ fontSize: 'clamp(34px,5vw,52px)', color: '#0b4a34', margin: '4px 0' }} role="timer" aria-label={`${h} hours ${m} minutes remaining`}>{pad(h)}:{pad(m)}:{pad(s)}</span></div>
    <div className="tm" aria-hidden><i style={{ width: `${(left / TOTAL) * 100}%` }} /></div>
    <span className="k">We pack both orders together, so you save the postage and the merchant ships once.</span></div>);
}
