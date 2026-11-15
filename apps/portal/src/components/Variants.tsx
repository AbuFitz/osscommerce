'use client';
import { useState, useTransition } from 'react';
import { Plus, Trash2, Wand2, X } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { combinations, validateDraft } from '@oss-commerce/contracts';
import { saveVariants } from '@/app/actions';
import type { OptionGroup, ProductDetail, TaxClass } from '@/lib/gateway';

interface Row { sku: string; options: string[]; price: string; stock: string; tax: TaxClass; enabled: boolean; weight: string; reserved: number }
const key = (o: string[]) => o.join('\u0000');
const TAX: Record<TaxClass, string> = { standard: 'Standard 20%', reduced: 'Reduced 5%', zero: 'Zero 0%' };
const toRows = (p: ProductDetail): Row[] => p.variantList.map(v => ({ sku: v.sku, options: v.options, price: (v.priceMinor / 100).toFixed(2), stock: String(v.onHand), tax: v.taxClass, enabled: v.enabled, weight: v.weightGrams ? String(v.weightGrams) : '', reserved: v.allocated }));

export function EditVariants({ product }: { product: ProductDetail }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const [groups, setGroups] = useState<{ name: string; values: string }[]>([]); const [rows, setRows] = useState<Row[]>([]); const [err, setErr] = useState<string | null>(null);
  const show = () => { setGroups(product.optionGroups.map(g => ({ name: g.name, values: g.options.join(', ') }))); setRows(toRows(product)); setErr(null); setOpen(true); };
  const parsed = (): OptionGroup[] => groups.filter(g => g.name.trim()).map(g => ({ name: g.name.trim(), options: [...new Set(g.values.split(',').map(x => x.trim()).filter(Boolean))] }));
  const base = (): string => (rows[0]?.sku || product.sku).replace(/-[A-Z0-9]{1,3}(-[A-Z0-9]{1,3})*$/, '');
  /** Keeps rows that already exist (matched by their option values); creates rows only for new combinations. */
  const generate = () => {
    const g = parsed(); if (g.some(x => !x.options.length)) { setErr('Give every option at least one value, separated by commas.'); return; }
    const existing = new Map(rows.map(r => [key(r.options), r])); const price = rows[0]?.price ?? (product.priceMinor / 100).toFixed(2);
    const next = (g.length ? combinations(g) : [[]]).map(o => existing.get(key(o)) ?? { sku: `${base()}-${o.map(v => v.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).join('-')}`.toUpperCase().replace(/-$/, ''), options: o, price, stock: '0', tax: rows[0]?.tax ?? 'standard' as TaxClass, enabled: true, weight: '', reserved: 0 });
    const dropped = rows.filter(r => !next.some(n => key(n.options) === key(r.options))).length; setRows(next); setErr(null);
    if (dropped) toast(`${dropped} existing variant${dropped > 1 ? 's' : ''} will be removed when you save.`, 'info');
  };
  const set = (i: number, p: Partial<Row>) => setRows(r => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const save = () => {
    const g = parsed(); const bad = rows.find(r => !/^\d+(\.\d{1,2})?$/.test(r.price)); if (bad) { setErr(`${bad.sku}: enter a price like 12.50.`); return; }
    const badStock = rows.find(r => !/^\d+$/.test(r.stock)); if (badStock) { setErr(`${badStock.sku}: stock must be a whole number.`); return; }
    const low = rows.find(r => Number(r.stock) < r.reserved); if (low) { setErr(`${low.sku}: ${low.reserved} are reserved for open orders, so stock cannot go below that.`); return; }
    const variants = rows.map(r => ({ options: r.options, sku: r.sku.trim().toUpperCase(), priceMinor: Math.round(Number(r.price) * 100), stock: Number(r.stock), taxClass: r.tax, enabled: r.enabled, weightGrams: r.weight ? Number(r.weight) : undefined }));
    const problems = validateDraft({ title: product.title, optionGroups: g, variants }); if (problems.length) { setErr(problems[0]); return; }
    start(async () => { const r = await saveVariants(product.id, { optionGroups: g, variants }); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setOpen(false); else setErr(r.message); });
  };
  return (<>
    <button className="btn" type="button" onClick={show}>Edit variants</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Edit options and variants" description="Options are the choices a customer makes, like size or colour. Each combination is a variant with its own SKU, price and stock."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" onClick={save} disabled={pending} aria-busy={pending}>{pending ? 'Saving…' : 'Save variants'}</button></>}>
      <div className="fd vedit">
        <fieldset className="vgroups"><legend>Options</legend>
          {groups.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>No options. This product has a single variant. Add an option like Size to sell versions of it.</p>}
          {groups.map((g, i) => (<div className="vg" key={i}>
            <div className="field"><label htmlFor={`gn${i}`}>Name</label><input id={`gn${i}`} value={g.name} placeholder="Size" onChange={e => setGroups(x => x.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))} /></div>
            <div className="field"><label htmlFor={`gv${i}`}>Values, separated by commas</label><input id={`gv${i}`} value={g.values} placeholder="Small, Large" onChange={e => setGroups(x => x.map((y, k) => (k === i ? { ...y, values: e.target.value } : y)))} /></div>
            <button type="button" className="iconbtn sm" aria-label={`Remove ${g.name || 'option'}`} onClick={() => setGroups(x => x.filter((_, k) => k !== i))}><X size={15} aria-hidden /></button></div>))}
          <div className="vbtns">{groups.length < 3 && <button type="button" className="btn sm" onClick={() => setGroups(x => [...x, { name: '', values: '' }])}><Plus size={14} aria-hidden />Add option</button>}<button type="button" className="btn sm" onClick={generate}><Wand2 size={14} aria-hidden />Update variants from options</button></div></fieldset>
        <fieldset className="vrows"><legend>{rows.length} variant{rows.length === 1 ? '' : 's'}</legend>
          {rows.map((r, i) => (<div className={`vrow${r.enabled ? '' : ' off'}`} key={key(r.options) + i}>
            <div className="vname"><b>{r.options.length ? r.options.join(' · ') : 'Default'}</b>{r.reserved > 0 && <small>{r.reserved} reserved</small>}</div>
            <div className="field f-sku"><label htmlFor={`s${i}`}>SKU</label><input id={`s${i}`} value={r.sku} onChange={e => set(i, { sku: e.target.value })} /></div>
            <div className="field f-price"><label htmlFor={`p${i}`}>Price</label><div className="adorn"><span aria-hidden>£</span><input id={`p${i}`} inputMode="decimal" value={r.price} onChange={e => set(i, { price: e.target.value })} /></div></div>
            <div className="field f-stock"><label htmlFor={`t${i}`}>Stock</label><input id={`t${i}`} inputMode="numeric" value={r.stock} onChange={e => set(i, { stock: e.target.value })} /></div>
            <div className="field f-vat"><label htmlFor={`x${i}`}>VAT</label><select id={`x${i}`} value={r.tax} onChange={e => set(i, { tax: e.target.value as TaxClass })}>{Object.entries(TAX).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field f-weight"><label htmlFor={`w${i}`}>Weight (g)</label><input id={`w${i}`} inputMode="numeric" value={r.weight} placeholder="0" onChange={e => set(i, { weight: e.target.value })} /></div>
            <div className="vfoot"><label className="vsw"><input type="checkbox" checked={r.enabled} onChange={e => set(i, { enabled: e.target.checked })} /> On sale</label>
              {rows.length > 1 && <button type="button" className="btn sm" aria-label={`Remove variant ${r.sku}`} onClick={() => setRows(x => x.filter((_, k) => k !== i))}><Trash2 size={14} aria-hidden />Remove</button>}</div>
          </div>))}</fieldset>
        {err && <p className="ferr" role="alert">{err}</p>}
      </div>
    </Dialog></>);
}
