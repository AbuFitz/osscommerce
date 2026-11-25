'use client';
import { useId, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { saveZone } from '@/app/actions';
import { validateRate } from '@/lib/delivery';
import type { ShippingZone, WeightBand, ZoneRate } from '@/lib/gateway';

const money = /^\d+(\.\d{1,2})?$/; const pence = (s: string) => Math.round(Number(s) * 100); const gbp = (m?: number) => (m ? (m / 100).toFixed(2) : '');
const kgOf = (g?: number) => (g ? String(g / 1000) : ''); const grams = (s: string) => Math.round(Number(s) * 1000);
type Band = { kg: string; price: string };
type Row = { label: string; mode: 'flat' | 'weight'; price: string; free: string; bands: Band[]; limited: boolean; minOrder: string; maxOrder: string; maxKg: string };
const blank = (): Row => ({ label: '', mode: 'flat', price: '', free: '', bands: [{ kg: '1', price: '' }, { kg: '5', price: '' }], limited: false, minOrder: '', maxOrder: '', maxKg: '' });
const toRow = (r: ZoneRate): Row => ({ label: r.label, mode: r.bands?.length ? 'weight' : 'flat', price: gbp(r.priceMinor) || (r.priceMinor === 0 ? '0.00' : ''), free: gbp(r.freeOverMinor), bands: r.bands?.length ? r.bands.map(b => ({ kg: kgOf(b.upToGrams), price: (b.priceMinor / 100).toFixed(2) })) : blank().bands,
  limited: !!r.when, minOrder: gbp(r.when?.minOrderMinor), maxOrder: gbp(r.when?.maxOrderMinor), maxKg: kgOf(r.when?.maxWeightGrams) });
const toRate = (r: Row): ZoneRate => {
  const when = r.limited ? { ...(r.minOrder.trim() ? { minOrderMinor: pence(r.minOrder) } : {}), ...(r.maxOrder.trim() ? { maxOrderMinor: pence(r.maxOrder) } : {}), ...(r.maxKg.trim() ? { maxWeightGrams: grams(r.maxKg) } : {}) } : undefined;
  const bands: WeightBand[] | undefined = r.mode === 'weight' ? r.bands.filter(b => b.kg.trim() || b.price.trim()).map(b => ({ upToGrams: grams(b.kg), priceMinor: pence(b.price) })) : undefined;
  return { label: r.label.trim(), priceMinor: r.mode === 'flat' ? pence(r.price) : 0, freeOverMinor: r.mode === 'flat' && r.free.trim() ? pence(r.free) : undefined, ...(when && Object.keys(when).length ? { when } : {}), ...(bands ? { bands } : {}) };
};

/** Add or edit a delivery zone: where it covers, and each option's price and when it is offered. Phones get a sheet, larger screens a dialog. */
export function ZoneDialog({ zone, triggerClass = 'btn primary', label = 'Add zone' }: { zone?: ShippingZone; triggerClass?: string; label?: string }) {
  const uid = useId(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [err, setErr] = useState<Record<string, string>>({});
  const init = () => ({ name: zone?.name ?? '', regions: zone?.regions ?? '', rates: (zone?.rates ?? [{ label: 'Standard, 2–4 days', priceMinor: 495 }]).map(toRow) });
  const [v, setV] = useState(init);
  const set = (i: number, p: Partial<Row>) => setV(x => ({ ...x, rates: x.rates.map((r, k) => (k === i ? { ...r, ...p } : r)) }));
  const setBand = (i: number, b: number, p: Partial<Band>) => setV(x => ({ ...x, rates: x.rates.map((r, k) => (k === i ? { ...r, bands: r.bands.map((q, n) => (n === b ? { ...q, ...p } : q)) } : r)) }));
  const save = () => {
    const e: Record<string, string> = {}; if (!v.name.trim()) e.name = 'Enter a name for this zone.'; if (!v.regions.trim()) e.regions = 'Say where this zone covers.';
    v.rates.forEach((r, i) => {
      if (!r.label.trim()) { e[`l${i}`] = 'Name this option.'; return; }
      const nums: [string, string, string][] = r.mode === 'flat' ? [[r.price, `p${i}`, 'Enter a price like 4.95.'], [r.free, `f${i}`, 'Enter an amount.']] : [];
      for (const [val, k, m] of nums) if ((k.startsWith('p') || val.trim()) && !money.test(val.trim())) e[k] = m;
      if (r.mode === 'weight') r.bands.filter(b => b.kg.trim() || b.price.trim()).forEach((b, n) => { if (!/^\d+(\.\d+)?$/.test(b.kg.trim()) || Number(b.kg) <= 0) e[`b${i}`] = 'Each weight band needs a weight in kg, like 2.'; if (!money.test(b.price.trim())) e[`b${i}`] = 'Each weight band needs a price like 4.95.'; void n; });
      if (r.limited) { for (const [val, nm] of [[r.minOrder, 'smallest order'], [r.maxOrder, 'largest order']] as const) if (val.trim() && !money.test(val.trim())) e[`w${i}`] = `Enter the ${nm} as an amount like 30.`; if (r.maxKg.trim() && !(/^\d+(\.\d+)?$/.test(r.maxKg.trim()) && Number(r.maxKg) > 0)) e[`w${i}`] = 'Enter the heaviest weight in kg, like 2.'; }
      if (!e[`p${i}`] && !e[`f${i}`] && !e[`b${i}`] && !e[`w${i}`]) { const bad = validateRate(toRate(r)); if (bad) e[`x${i}`] = bad; }
    });
    setErr(e); if (Object.keys(e).length) return;
    start(async () => { const r = await saveZone({ originalName: zone?.name, name: v.name, regions: v.regions, rates: v.rates.map(toRate) }); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setOpen(false); });
  };
  const first = Object.entries(err).find(([k, m]) => m && k !== 'name' && k !== 'regions')?.[1];
  return (<>
    <button className={triggerClass} type="button" onClick={() => { setV(init()); setErr({}); setOpen(true); }}>{label}</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title={zone ? `Edit ${zone.name}` : 'Add delivery zone'} description="Customers in this zone are offered the options below that fit their order."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending} aria-busy={pending} onClick={save}>{pending ? 'Saving…' : 'Save zone'}</button></>}>
      <div className="fd">
        <div className={`field${err.name ? ' bad' : ''}`}><label htmlFor={`${uid}zn`}>Zone name</label><input id={`${uid}zn`} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} aria-invalid={!!err.name} />{err.name && <p className="ferr" role="alert">{err.name}</p>}</div>
        <div className={`field${err.regions ? ' bad' : ''}`}><label htmlFor={`${uid}zr`}>Where it covers</label><input id={`${uid}zr`} value={v.regions} placeholder="United Kingdom, Ireland" onChange={e => setV({ ...v, regions: e.target.value })} aria-invalid={!!err.regions} aria-describedby={`${uid}zh`} />
          <p className="fhint muted" id={`${uid}zh`}>Countries, or UK postcode areas such as <b>IV, KW</b>, ranges such as <b>PA20–80</b>, or outward codes such as <b>SW1A</b>. A zone with postcode areas serves only those; a zone with just countries serves the rest.</p>{err.regions && <p className="ferr" role="alert">{err.regions}</p>}</div>
        <div className="dz-rates" role="group" aria-label="Delivery options">
          {v.rates.map((r, i) => (<fieldset className="dz-rate" key={i}>
            <div className="dz-top"><div className={`field${err[`l${i}`] ? ' bad' : ''}`}><label htmlFor={`${uid}rl${i}`}>Option name</label><input id={`${uid}rl${i}`} value={r.label} placeholder="Standard, 2–4 days" onChange={e => set(i, { label: e.target.value })} aria-invalid={!!err[`l${i}`]} /></div>
              {v.rates.length > 1 && <button type="button" className="iconbtn sm" aria-label={`Remove ${r.label || 'option'}`} onClick={() => setV(x => ({ ...x, rates: x.rates.filter((_, k) => k !== i) }))}><Trash2 size={15} aria-hidden /></button>}</div>
            <div className="seg-field" role="radiogroup" aria-label="How it is priced"><button type="button" role="radio" aria-checked={r.mode === 'flat'} data-on={r.mode === 'flat'} onClick={() => set(i, { mode: 'flat' })}>One price</button><button type="button" role="radio" aria-checked={r.mode === 'weight'} data-on={r.mode === 'weight'} onClick={() => set(i, { mode: 'weight' })}>By weight</button></div>
            {r.mode === 'flat' ? (<div className="pf-row">
              <div className={`field${err[`p${i}`] ? ' bad' : ''}`}><label htmlFor={`${uid}rp${i}`}>Price</label><div className="adorn"><span aria-hidden>£</span><input id={`${uid}rp${i}`} inputMode="decimal" value={r.price} onChange={e => set(i, { price: e.target.value })} aria-invalid={!!err[`p${i}`]} /></div></div>
              <div className={`field${err[`f${i}`] ? ' bad' : ''}`}><label htmlFor={`${uid}rf${i}`}>Free over</label><div className="adorn"><span aria-hidden>£</span><input id={`${uid}rf${i}`} inputMode="decimal" placeholder="None" value={r.free} onChange={e => set(i, { free: e.target.value })} aria-invalid={!!err[`f${i}`]} /></div></div></div>)
            : (<div className="dz-bands"><p className="fhint muted">The price depends on how heavy the order is. Items with no weight count as zero, so set weights on your products.</p>
              {r.bands.map((b, n) => (<div className="dz-band" key={n}><div className="field"><label htmlFor={`${uid}bk${i}${n}`}>Up to (kg)</label><input id={`${uid}bk${i}${n}`} inputMode="decimal" value={b.kg} onChange={e => setBand(i, n, { kg: e.target.value })} /></div>
                <div className="field"><label htmlFor={`${uid}bp${i}${n}`}>Price</label><div className="adorn"><span aria-hidden>£</span><input id={`${uid}bp${i}${n}`} inputMode="decimal" value={b.price} onChange={e => setBand(i, n, { price: e.target.value })} /></div></div>
                {r.bands.length > 1 && <button type="button" className="iconbtn sm" aria-label="Remove this band" onClick={() => set(i, { bands: r.bands.filter((_, k) => k !== n) })}><Trash2 size={15} aria-hidden /></button>}</div>))}
              {r.bands.length < 12 && <button type="button" className="btn sm" onClick={() => set(i, { bands: [...r.bands, { kg: '', price: '' }] })}><Plus size={14} aria-hidden />Add a weight band</button>}</div>)}
            <label className="check1"><input type="checkbox" checked={r.limited} onChange={e => set(i, { limited: e.target.checked })} /> Only offer this when…</label>
            {r.limited && (<div className="dz-when"><div className="pf-row"><div className="field"><label htmlFor={`${uid}mn${i}`}>Order is at least</label><div className="adorn"><span aria-hidden>£</span><input id={`${uid}mn${i}`} inputMode="decimal" placeholder="No minimum" value={r.minOrder} onChange={e => set(i, { minOrder: e.target.value })} /></div></div>
              <div className="field"><label htmlFor={`${uid}mx${i}`}>Order is at most</label><div className="adorn"><span aria-hidden>£</span><input id={`${uid}mx${i}`} inputMode="decimal" placeholder="No maximum" value={r.maxOrder} onChange={e => set(i, { maxOrder: e.target.value })} /></div></div></div>
              <div className="field"><label htmlFor={`${uid}mk${i}`}>Order weighs at most (kg)</label><input id={`${uid}mk${i}`} inputMode="decimal" placeholder="No limit" value={r.maxKg} onChange={e => set(i, { maxKg: e.target.value })} /></div></div>)}
            {(err[`b${i}`] || err[`w${i}`] || err[`x${i}`]) && <p className="ferr" role="alert">{err[`b${i}`] || err[`w${i}`] || err[`x${i}`]}</p>}
          </fieldset>))}
          {first && <p className="ferr" role="alert">{first}</p>}
          {v.rates.length < 10 && <button type="button" className="btn sm" onClick={() => setV(x => ({ ...x, rates: [...x.rates, blank()] }))}><Plus size={14} aria-hidden />Add a delivery option</button>}
        </div>
      </div></Dialog></>);
}
