'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { createProductWithImages, removeProduct, saveProduct } from '@/app/actions';
import { ImageManager } from './ImageManager';
import type { ProductDetail } from '@/lib/gateway';

type V = { title: string; description: string; price: string; compareAt: string; taxClass: 'standard' | 'reduced' | 'zero'; sku: string; barcode: string; stock: string; weight: string; handle: string; seoTitle: string; seoDescription: string; status: 'draft' | 'published' };
const BLANK: V = { title: '', description: '', price: '', compareAt: '', taxClass: 'standard', sku: '', barcode: '', stock: '0', weight: '', handle: '', seoTitle: '', seoDescription: '', status: 'draft' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const gbp = (s: string) => (s && Number.isFinite(Number(s)) ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(s)) : '');
const isMoney = (s: string) => /^\d{1,7}(\.\d{1,2})?$/.test(s);

const fromProduct = (p: ProductDetail): V => { const v = p.variantList[0]; return { ...BLANK, title: p.title, description: p.description, handle: p.handle, seoTitle: p.seoTitle, seoDescription: p.seoDescription, status: p.status === 'published' ? 'published' : 'draft',
  price: (p.priceMinor / 100).toFixed(2), sku: p.sku, ...(v ? { compareAt: v.compareAtMinor ? (v.compareAtMinor / 100).toFixed(2) : '', barcode: v.barcode ?? '', weight: v.weightGrams ? String(v.weightGrams) : '', taxClass: v.taxClass } : {}) }; };

function Count({ n, soft, hard }: { n: number; soft: number; hard: number }) { return <span className={`pf-count${n > hard ? ' bad' : n > soft ? ' warn' : ''}`} aria-live="polite">{n}/{soft}</span>; }

/** One form for adding and editing a product. Edits to an existing product's price and stock live with its variants below; everything about the product itself is here. */
export function ProductForm({ product }: { product?: ProductDetail }) {
  const toast = useToast(); const router = useRouter(); const [pending, start] = useTransition(); const editing = !!product;
  const initial = useMemo(() => (product ? fromProduct(product) : BLANK), [product]); const [v, setV] = useState<V>(initial); const [files, setFiles] = useState<File[]>([]); const [touched, setTouched] = useState<Record<string, boolean>>({}); const [tried, setTried] = useState(false); const [del, setDel] = useState(false); const [handleEdited, setHandleEdited] = useState(!!product?.handle);
  useEffect(() => { setV(initial); setHandleEdited(!!product?.handle); }, [initial, product?.handle]);
  const set = <K extends keyof V>(k: K, val: V[K]) => setV(p => ({ ...p, [k]: val, ...(k === 'title' && !handleEdited && !editing ? { handle: slug(String(val)) } : {}) }));
  const dirty = editing ? JSON.stringify(v) !== JSON.stringify(initial) : v.title !== '' || v.price !== '' || files.length > 0;
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  const err: Partial<Record<keyof V, string>> = {};
  if (!v.title.trim()) err.title = 'Give the product a name.'; else if (v.title.length > 120) err.title = 'Keep the name under 120 characters.';
  if (!editing) {
    if (!isMoney(v.price)) err.price = 'Enter a price such as 18 or 18.50.';
    if (v.compareAt && (!isMoney(v.compareAt) || Number(v.compareAt) <= Number(v.price))) err.compareAt = 'Must be higher than the price.';
    if (!/^\d{1,9}$/.test(v.stock || '0')) err.stock = 'A whole number.'; if (v.weight && !/^\d{1,9}$/.test(v.weight)) err.weight = 'Whole grams, for example 250.';
  }
  if (v.handle && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.handle)) err.handle = 'Lowercase letters, numbers and dashes only.';
  const show = (k: keyof V) => (tried || touched[k]) && err[k]; const blur = (k: keyof V) => setTouched(t => ({ ...t, [k]: true }));
  const bad = Object.keys(err).length > 0;

  const submit = () => {
    setTried(true); if (bad) { const first = (Object.keys(err) as (keyof V)[])[0]; document.getElementById(`pf-${first}`)?.focus(); toast('Fix the highlighted fields first.', 'error'); return; }
    start(async () => {
      if (editing) { const r = await saveProduct(product!.id, { title: v.title, description: v.description, handle: v.handle, seoTitle: v.seoTitle, seoDescription: v.seoDescription, status: v.status }); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); return; }
      const body = new FormData(); (Object.keys(v) as (keyof V)[]).forEach(k => body.set(k, v[k])); files.forEach(f => body.append('file', f));
      const r = await createProductWithImages(body); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok && r.id) { setV(BLANK); setFiles([]); router.push(`/products/${r.id}`); }
    });
  };
  const fld = (k: keyof V, label: string, props: React.InputHTMLAttributes<HTMLInputElement> & { hint?: string; adorn?: string } = {}) => { const { hint, adorn, ...rest } = props; const e = show(k);
    return (<div className={`field${e ? ' bad' : ''}`}><label htmlFor={`pf-${k}`}>{label}</label><div className={adorn ? 'adorn' : undefined}>{adorn && <span aria-hidden>{adorn}</span>}<input id={`pf-${k}`} value={v[k]} onChange={x => set(k, x.target.value as never)} onBlur={() => blur(k)} aria-invalid={!!e} aria-describedby={e ? `pf-${k}-e` : hint ? `pf-${k}-h` : undefined} {...rest} /></div>
      {e ? <p className="ferr" id={`pf-${k}-e`} role="alert">{err[k]}</p> : hint ? <p className="fhint muted" id={`pf-${k}-h`}>{hint}</p> : null}</div>); };
  const seoTitle = v.seoTitle || v.title || 'Product name'; const seoDesc = v.seoDescription || v.description.replace(/\s+/g, ' ').slice(0, 155) || 'The product description appears here.';

  return (<form className="pf" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
    <div className="pf-main">
      <section className="w fd" aria-labelledby="pf-s1"><h2 id="pf-s1">Product</h2>
        {fld('title', 'Name', { required: true, maxLength: 140, placeholder: 'Stoneware mug, speckled', autoFocus: !editing })}
        <div className="field"><label htmlFor="pf-description">Description</label><textarea id="pf-description" rows={7} value={v.description} onChange={e => set('description', e.target.value)} placeholder="What it is, what it is made from, size, care. Shoppers read this before they buy." />
          <p className="fhint muted">Plain text. Blank lines start a new paragraph.</p></div>
      </section>
      <section className="w" aria-labelledby="pf-s2"><div className="wh"><h2 id="pf-s2">Photos</h2></div><ImageManager productId={product?.id} initial={product?.images ?? []} onFiles={setFiles} /></section>
      {!editing && (<>
        <section className="w fd" aria-labelledby="pf-s3"><h2 id="pf-s3">Pricing</h2>
          <div className="pf-row">{fld('price', 'Price', { inputMode: 'decimal', adorn: '£', placeholder: '0.00', required: true, hint: 'What the customer pays, including VAT.' })}{fld('compareAt', 'Compare-at price', { inputMode: 'decimal', adorn: '£', placeholder: '0.00', hint: 'The old price, shown crossed out.' })}</div>
          <div className="field"><label htmlFor="pf-taxClass">VAT rate</label><select id="pf-taxClass" value={v.taxClass} onChange={e => set('taxClass', e.target.value as V['taxClass'])}><option value="standard">Standard rate</option><option value="reduced">Reduced rate</option><option value="zero">Zero rate</option></select></div>
          {v.price && isMoney(v.price) && v.compareAt && !err.compareAt && <p className="pf-sale"><Check size={14} aria-hidden />Shown as <s>{gbp(v.compareAt)}</s> <b>{gbp(v.price)}</b>, {Math.round((1 - Number(v.price) / Number(v.compareAt)) * 100)}% off.</p>}
        </section>
        <section className="w fd" aria-labelledby="pf-s4"><h2 id="pf-s4">Inventory and shipping</h2>
          <div className="pf-row">{fld('sku', 'SKU', { hint: 'We make one from the name if you leave it blank.', maxLength: 40 })}{fld('barcode', 'Barcode', { hint: 'EAN or UPC, optional.', maxLength: 64, inputMode: 'numeric' })}</div>
          <div className="pf-row">{fld('stock', 'Stock on hand', { inputMode: 'numeric', hint: 'How many you have right now.' })}{fld('weight', 'Weight (grams)', { inputMode: 'numeric', hint: 'Used for weight-based delivery prices.' })}</div>
          <p className="muted pf-note">Need sizes, colours or other options? Save the product first, then add them under Variants.</p>
        </section></>)}
      <section className="w fd" aria-labelledby="pf-s5"><h2 id="pf-s5">Search engine listing</h2>
        <div className="pf-serp" aria-label="How this looks in search results"><span className="u">yourstore.co.uk › products › {v.handle || slug(v.title) || 'product'}</span><b className="t">{seoTitle.slice(0, 70)}{seoTitle.length > 70 ? '…' : ''}</b><span className="d">{seoDesc.slice(0, 160)}{seoDesc.length > 160 ? '…' : ''}</span></div>
        <div className="field"><div className="pf-lab"><label htmlFor="pf-seoTitle">Page title</label><Count n={v.seoTitle.length} soft={60} hard={120} /></div><input id="pf-seoTitle" value={v.seoTitle} maxLength={120} onChange={e => set('seoTitle', e.target.value)} placeholder={v.title || 'Defaults to the product name'} /></div>
        <div className="field"><div className="pf-lab"><label htmlFor="pf-seoDescription">Meta description</label><Count n={v.seoDescription.length} soft={155} hard={320} /></div><textarea id="pf-seoDescription" rows={3} value={v.seoDescription} maxLength={320} onChange={e => set('seoDescription', e.target.value)} placeholder="Defaults to the start of the description" /></div>
        {fld('handle', 'Web address', { adorn: '/', hint: 'The end of the product page address.', onChange: e => { setHandleEdited(true); set('handle', e.target.value.toLowerCase()); } })}
      </section>
      {editing && <section className="w pf-danger" aria-labelledby="pf-s6"><h2 id="pf-s6">Delete product</h2><p className="muted">Removes the product, its variants and photos from your store. Past orders keep their details. Set it to draft instead if you only want to hide it.</p><button type="button" className="btn danger" onClick={() => setDel(true)}><Trash2 size={15} aria-hidden />Delete product</button></section>}
    </div>
    <aside className="pf-side">
      <section className="w fd pf-sticky" aria-labelledby="pf-st"><h2 id="pf-st">Status</h2>
        <div className="seg-field" role="radiogroup" aria-label="Status">{([['draft', 'Draft', EyeOff], ['published', 'Published', Eye]] as const).map(([k, l, I]) => <button key={k} type="button" role="radio" aria-checked={v.status === k} data-on={v.status === k || undefined} onClick={() => set('status', k)}><I size={14} aria-hidden /> {l}</button>)}</div>
        <p className="muted pf-note">{v.status === 'published' ? 'Customers can see and buy this product.' : 'Hidden from your store until you publish it.'}</p>
        {editing && v.status === 'published' && (product!.onHand - product!.allocated) <= 0 && <p className="pf-warn"><AlertTriangle size={14} aria-hidden />Published, but nothing is in stock.</p>}
        <button className="btn primary" type="submit" disabled={pending || (editing && !dirty)} aria-busy={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : v.status === 'published' ? 'Save and publish' : 'Save as draft'}</button>
        {dirty && <button type="button" className="btn" disabled={pending} onClick={() => { setV(initial); setTouched({}); setTried(false); if (!editing) { setFiles([]); router.refresh(); } }}>Discard changes</button>}
        {dirty && <p className="pf-dirty" role="status">You have unsaved changes.</p>}
      </section>
    </aside>
    {editing && <Dialog open={del} onClose={() => !pending && setDel(false)} title={`Delete ${product!.title}?`} description="This cannot be undone."
      footer={<><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep it</button><button className="btn danger" type="button" disabled={pending} onClick={() => start(async () => { const r = await removeProduct(product!.id); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) router.push('/products'); else setDel(false); })}>Delete product</button></>}><p>All of its variants and photos go with it.</p></Dialog>}
  </form>);
}
