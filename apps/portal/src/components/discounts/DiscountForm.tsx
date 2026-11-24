'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Check, Search } from 'lucide-react';
import { discountProductsAction, saveDiscountAction } from '@/app/actions';
import { describeDiscount, validateDiscount } from '@/lib/discounts';
import type { Discount, DiscountInput, DiscountProduct } from '@/lib/gateway';

type Kind = DiscountInput['kind'];
type V = { method: 'code' | 'automatic'; code: string; name: string; kind: Kind; value: string; scope: 'order' | 'products'; productIds: string[]; minSpend: string; buy: string; get: string; limit: string; perCustomer: string; startDate: string; endDate: string; enabled: boolean };
const BLANK: V = { method: 'code', code: '', name: '', kind: 'percent', value: '10', scope: 'order', productIds: [], minSpend: '', buy: '2', get: '1', limit: '', perCustomer: '', startDate: '', endDate: '', enabled: true };
const KINDS: { k: Kind; l: string; d: string }[] = [{ k: 'percent', l: 'Percentage off', d: 'Such as 20% off' }, { k: 'fixed', l: 'Amount off', d: 'Such as £5 off the order' }, { k: 'shipping', l: 'Free delivery', d: 'Delivery costs nothing' }, { k: 'bogo', l: 'Buy X get Y', d: 'Such as buy 2 get 1 free' }];
const toMinor = (s: string) => (s.trim() === '' ? undefined : Math.round(Number(s) * 100));
const toInt = (s: string) => (s.trim() === '' ? undefined : Number(s));
const ymd = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const fromDiscount = (d: Discount): V => ({ method: d.automatic ? 'automatic' : 'code', code: d.code, name: d.name ?? '', kind: d.kind === 'custom' ? 'percent' : d.kind, value: d.kind === 'fixed' ? (d.value / 100).toString() : String(d.value || ''), scope: d.productIds?.length ? 'products' : 'order', productIds: d.productIds ?? [], minSpend: d.minSpendMinor ? (d.minSpendMinor / 100).toString() : '', buy: String(d.buy ?? 2), get: String(d.get ?? 1), limit: d.limit ? String(d.limit) : '', perCustomer: d.perCustomer ? String(d.perCustomer) : '', startDate: ymd(d.startsAt), endDate: ymd(d.endsAt), enabled: d.status !== 'paused' });
const randomCode = () => { const w = ['SPRING', 'THANKS', 'WELCOME', 'SAVE', 'TREAT', 'EXTRA']; return `${w[Math.floor(Math.random() * w.length)]}${10 + Math.floor(Math.random() * 40)}`; };

/** Create or edit a discount. The sentence at the bottom is rebuilt as you type so you can check exactly what customers will get. */
export function DiscountForm({ open, onClose, discount, today }: { open: boolean; onClose: () => void; discount?: Discount; today: string }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [v, setV] = useState<V>(discount ? fromDiscount(discount) : BLANK); const [products, setProducts] = useState<DiscountProduct[] | null>(null); const [q, setQ] = useState(''); const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setV(discount ? fromDiscount(discount) : BLANK); setTried(false); setQ(''); } }, [open, discount]);
  useEffect(() => { if (open && products === null && (v.kind === 'bogo' || v.scope === 'products')) void discountProductsAction().then(setProducts); }, [open, v.kind, v.scope, products]);
  const set = <K extends keyof V>(k: K, val: V[K]) => setV(p => ({ ...p, [k]: val }));
  const input: DiscountInput = useMemo(() => ({ id: discount?.id, method: v.method, code: v.method === 'code' ? v.code.trim().toUpperCase() : undefined, name: v.name.trim() || undefined, kind: v.kind, value: v.kind === 'percent' ? Number(v.value) : v.kind === 'fixed' ? Math.round(Number(v.value) * 100) : 0, minSpendMinor: toMinor(v.minSpend),
    productIds: (v.kind === 'bogo' || (v.kind === 'percent' && v.scope === 'products')) ? v.productIds : undefined, buy: v.kind === 'bogo' ? toInt(v.buy) : undefined, get: v.kind === 'bogo' ? toInt(v.get) : undefined, limit: toInt(v.limit), perCustomer: toInt(v.perCustomer), startDate: v.startDate || undefined, endDate: v.endDate || undefined, enabled: v.enabled }), [v, discount?.id]);
  const problem = validateDiscount(input, today); const names = (products ?? []).filter(p => v.productIds.includes(p.id)).map(p => p.title);
  const sentence = describeDiscount({ ...input, productNames: names.length ? names : (input.productIds?.length ? [`${input.productIds.length} product${input.productIds.length > 1 ? 's' : ''}`] : undefined), method: v.method, code: v.code });
  const list = (products ?? []).filter(p => p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const save = () => { setTried(true); if (problem) { toast(problem, 'error'); return; } start(async () => { const r = await saveDiscountAction(input); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) onClose(); }); };
  const toggle = (id: string) => set('productIds', v.productIds.includes(id) ? v.productIds.filter(x => x !== id) : [...v.productIds, id]);
  const field = (id: string, label: string, el: React.ReactNode, hint?: string) => <div className="field"><label htmlFor={id}>{label}</label>{el}{hint && <p className="fhint muted">{hint}</p>}</div>;

  return (<Dialog open={open} onClose={() => !pending && onClose()} title={discount ? 'Edit discount' : 'Create discount'} description="Choose what customers get, and when. Check the summary at the bottom."
    footer={<><button className="btn" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending} aria-busy={pending} onClick={save}>{pending ? 'Saving…' : discount ? 'Save discount' : v.enabled ? 'Create discount' : 'Save as paused'}</button></>}>
    <div className="fd dform">
      <fieldset className="dseg"><legend>How customers get it</legend><div role="radiogroup" aria-label="How customers get it">{([['code', 'Discount code', 'Customers type a code at checkout'], ['automatic', 'Automatic', 'Applies by itself at checkout']] as const).map(([k, l, d]) => <button key={k} type="button" role="radio" aria-checked={v.method === k} onClick={() => set('method', k)}><b>{l}</b><span>{d}</span></button>)}</div></fieldset>
      {v.method === 'code' && field('d-code', 'Code', <div className="dcode"><input id="d-code" value={v.code} maxLength={24} autoCapitalize="characters" spellCheck={false} onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-invalid={tried && !!problem && /code/i.test(problem)} placeholder="SUMMER20" /><button type="button" className="btn" onClick={() => set('code', randomCode())}>Make one</button></div>, 'Letters and numbers, no spaces. Customers are not case sensitive.')}
      {field('d-name', 'Name', <input id="d-name" value={v.name} maxLength={120} onChange={e => set('name', e.target.value)} placeholder={v.method === 'code' ? 'Defaults to the code' : 'For example: Tea towels, 3 for 2'} />, 'Only you see this.')}
      <fieldset className="dseg"><legend>What it does</legend><div className="dkinds" role="radiogroup" aria-label="Discount type">{KINDS.map(x => <button key={x.k} type="button" role="radio" aria-checked={v.kind === x.k} onClick={() => setV(p => ({ ...p, kind: x.k, scope: x.k === 'percent' ? p.scope : 'order' }))}><b>{x.l}</b><span>{x.d}</span></button>)}</div></fieldset>
      {v.kind === 'percent' && field('d-val', 'Percentage', <div className="adorn"><input id="d-val" inputMode="decimal" value={v.value} onChange={e => set('value', e.target.value)} /><span style={{ left: 'auto', right: 14 }}>%</span></div>)}
      {v.kind === 'fixed' && field('d-val', 'Amount off', <div className="adorn"><span>£</span><input id="d-val" inputMode="decimal" value={v.value} onChange={e => set('value', e.target.value)} /></div>, 'Comes off the whole order.')}
      {v.kind === 'bogo' && <div className="dbogo"><div className="field"><label htmlFor="d-buy">Customer buys</label><input id="d-buy" inputMode="numeric" value={v.buy} onChange={e => set('buy', e.target.value)} /></div><div className="field"><label htmlFor="d-get">And gets free</label><input id="d-get" inputMode="numeric" value={v.get} onChange={e => set('get', e.target.value)} /></div></div>}
      {v.kind === 'percent' && <fieldset className="dseg"><legend>Applies to</legend><div role="radiogroup" aria-label="Applies to">{([['order', 'The whole order'], ['products', 'Chosen products']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={v.scope === k} onClick={() => set('scope', k)}><b>{l}</b></button>)}</div></fieldset>}
      {(v.kind === 'bogo' || (v.kind === 'percent' && v.scope === 'products')) && (<div className="dprod"><div className="dsearch"><Search size={15} aria-hidden /><input aria-label="Search products" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} /></div>
        {products === null ? <p className="muted">Loading your products…</p> : list.length === 0 ? <p className="muted">No products match.</p> : <ul role="listbox" aria-multiselectable aria-label="Products">{list.map(p => <li key={p.id}><button type="button" role="option" aria-selected={v.productIds.includes(p.id)} onClick={() => toggle(p.id)}><span className="tick">{v.productIds.includes(p.id) && <Check size={13} aria-hidden />}</span>{p.title}</button></li>)}</ul>}
        <small className="muted">{v.productIds.length ? `${v.productIds.length} chosen` : 'None chosen yet'}</small></div>)}
      {v.kind !== 'bogo' && field('d-min', 'Minimum spend', <div className="adorn"><span>£</span><input id="d-min" inputMode="decimal" value={v.minSpend} onChange={e => set('minSpend', e.target.value)} placeholder="No minimum" /></div>, 'The order must reach this before the discount applies.')}
      <div className="drow">{field('d-limit', 'Total uses', <input id="d-limit" inputMode="numeric" value={v.limit} onChange={e => set('limit', e.target.value)} placeholder="Unlimited" />)}{field('d-per', 'Uses per customer', <input id="d-per" inputMode="numeric" value={v.perCustomer} onChange={e => set('perCustomer', e.target.value)} placeholder="Unlimited" />)}</div>
      <div className="drow">{field('d-start', 'Starts', <input id="d-start" type="date" value={v.startDate} onChange={e => set('startDate', e.target.value)} />, 'Blank means now.')}{field('d-end', 'Ends', <input id="d-end" type="date" value={v.endDate} min={v.startDate || undefined} onChange={e => set('endDate', e.target.value)} />, 'Blank means no end.')}</div>
      <label className="check1"><input type="checkbox" checked={v.enabled} onChange={e => set('enabled', e.target.checked)} /> Active (untick to save it paused)</label>
      <p className={`dsum${tried && problem ? ' bad' : ''}`} role="status" aria-live="polite"><b>{tried && problem ? 'Fix this first:' : 'Customers get:'}</b> {tried && problem ? problem : sentence}</p>
    </div>
  </Dialog>);
}
