'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { deleteCollectionAction, discountProductsAction, previewCollection, saveCollectionAction } from '@/app/actions';
import type { Collection, DiscountProduct } from '@/lib/gateway';

/** Create or edit a collection: products join by a word in their name, or you pick them yourself. A live count shows what it would hold before you save. */
export function CollectionForm({ open, onClose, collection }: { open: boolean; onClose: () => void; collection?: Collection }) {
  const toast = useToast(); const [pending, start] = useTransition();
  const [name, setName] = useState(''); const [kind, setKind] = useState<'rule' | 'manual'>('rule'); const [term, setTerm] = useState(''); const [picked, setPicked] = useState<string[]>([]); const [products, setProducts] = useState<DiscountProduct[] | null>(null); const [q, setQ] = useState('');
  const [prev, setPrev] = useState<{ count: number; products: string[] } | null>(null); const [tried, setTried] = useState(false);
  useEffect(() => { if (!open) return; setName(collection?.name ?? ''); setKind(collection?.kind === 'manual' ? 'manual' : 'rule'); setTerm(collection?.contains ?? ''); setPicked(collection?.productIds ?? []); setQ(''); setTried(false); }, [open, collection]);
  useEffect(() => { if (open && kind === 'manual' && products === null) void discountProductsAction().then(setProducts); }, [open, kind, products]);
  useEffect(() => { if (kind !== 'rule' || !term.trim()) { setPrev(null); return; } let live = true; const t = setTimeout(async () => { const r = await previewCollection(term); if (live) setPrev(r); }, 250); return () => { live = false; clearTimeout(t); }; }, [term, kind]);
  const err = !name.trim() ? 'Give the collection a name.' : kind === 'rule' && !term.trim() ? 'Add a word to match.' : kind === 'manual' && !picked.length ? 'Choose at least one product.' : null;
  const save = () => { setTried(true); if (err) return; start(async () => { const r = await saveCollectionAction({ id: collection?.id, name, kind, contains: kind === 'rule' ? term : undefined, productIds: kind === 'manual' ? picked : undefined }); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) onClose(); }); };
  const list = (products ?? []).filter(p => p.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (<Dialog open={open} onClose={() => !pending && onClose()} title={collection ? 'Edit collection' : 'Create collection'} description="A collection groups products on your website, like a shelf."
    footer={<><button className="btn" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending} aria-busy={pending} onClick={save}>{pending ? 'Saving…' : collection ? 'Save collection' : 'Create collection'}</button></>}>
    <div className="fd dform">
      <div className={`field${tried && !name.trim() ? ' bad' : ''}`}><label htmlFor="cn">Name</label><input id="cn" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Kitchen and table" aria-invalid={tried && !name.trim()} />{tried && !name.trim() && <p className="ferr">Give the collection a name.</p>}</div>
      <fieldset className="dseg"><legend>Which products</legend><div role="radiogroup" aria-label="Which products">{([['rule', 'By name', 'Products join when their name contains a word'], ['manual', 'Pick products', 'You choose exactly which ones']] as const).map(([k, l, d]) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}><b>{l}</b><span>{d}</span></button>)}</div></fieldset>
      {kind === 'rule' ? (<><div className={`field${tried && !term.trim() ? ' bad' : ''}`}><label htmlFor="cr">Name contains</label><input id="cr" value={term} onChange={e => setTerm(e.target.value)} placeholder="mug" aria-invalid={tried && !term.trim()} /></div>
        <div className="cprev" role="status" aria-live="polite">{prev === null ? <span className="muted">Type a word to see what would be included.</span> : prev.count === 0 ? <span className="muted">Nothing matches yet.</span> : <><b>{prev.count} variant{prev.count > 1 ? 's' : ''}</b> from {prev.products.length} product{prev.products.length > 1 ? 's' : ''}: {prev.products.join(', ')}</>}</div></>)
        : (<div className="dprod"><div className="dsearch"><Search size={15} aria-hidden /><input aria-label="Search products" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} /></div>
          {products === null ? <p className="muted">Loading your products…</p> : list.length === 0 ? <p className="muted">No products match.</p> : <ul role="listbox" aria-multiselectable aria-label="Products">{list.map(p => <li key={p.id}><button type="button" role="option" aria-selected={picked.includes(p.id)} onClick={() => setPicked(a => a.includes(p.id) ? a.filter(x => x !== p.id) : [...a, p.id])}><span className="tick">{picked.includes(p.id) && <Check size={13} aria-hidden />}</span>{p.title}</button></li>)}</ul>}
          <small className="muted">{picked.length ? `${picked.length} chosen` : 'None chosen yet'}</small></div>)}
      {tried && err && <p className="dsum bad" role="alert"><b>Fix this first:</b> {err}</p>}
    </div>
  </Dialog>);
}

export function NewCollectionButton() { const [o, setO] = useState(false); return (<><button type="button" className="btn primary" onClick={() => setO(true)}><Plus size={15} aria-hidden />Create collection</button><CollectionForm open={o} onClose={() => setO(false)} /></>); }

export function CollectionCard({ c }: { c: Collection }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false);
  return (<article className="w ccard">
    <h2>{c.name}</h2>
    <p className="muted">{c.kind === 'rule' ? <>Name contains <b>“{c.contains}”</b></> : c.kind === 'manual' ? 'Hand-picked products' : 'Set up by us'}</p>
    <div className="cnum"><span className="num">{c.count}</span><span className="muted">variants in {c.products.length} product{c.products.length === 1 ? '' : 's'}</span></div>
    <p className="muted" style={{ margin: 0, fontSize: 13 }}>{c.products.join(', ') || 'No products match right now.'}</p>
    <div className="dc-acts">{c.kind !== 'other' && <button type="button" className="btn sm" onClick={() => setEdit(true)}><Pencil size={14} aria-hidden />Edit</button>}<button type="button" className="btn sm ghost" onClick={() => setDel(true)} aria-label={`Delete ${c.name}`}><Trash2 size={14} aria-hidden /></button></div>
    {c.kind !== 'other' && <CollectionForm open={edit} onClose={() => setEdit(false)} collection={c} />}
    <Dialog open={del} onClose={() => !pending && setDel(false)} title={`Delete ${c.name}?`} description="The products in it are not deleted, only the shelf."
      footer={<><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep it</button><button className="btn danger" type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteCollectionAction(c.id); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setDel(false); })}>Delete collection</button></>}><p className="muted">It will disappear from your website straight away.</p></Dialog>
  </article>);
}
