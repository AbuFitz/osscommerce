'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { addProductImages, saveProductImages } from '@/app/actions';
import type { ProductImage } from '@/lib/gateway';

const OK = ['image/jpeg', 'image/png', 'image/webp']; const MAX = 10 * 1024 * 1024; const LIMIT = 12;
type Item = { key: string; id?: string; url: string; name: string; file?: File; busy?: boolean };

/**
 * Product photos. On a new product the photos wait here and are saved with the product. On an existing product every change is saved straight away:
 * adding uploads, dragging (or the arrows) reorders, "Main" picks the first photo, and removing asks first. The first photo is the one shoppers see on listings.
 */
export function ImageManager({ productId, initial, onFiles }: { productId?: string; initial: ProductImage[]; onFiles?: (files: File[]) => void }) {
  const toast = useToast(); const router = useRouter(); const input = useRef<HTMLInputElement>(null); const [pending, start] = useTransition();
  const fromServer = (l: ProductImage[]): Item[] => l.map(i => ({ key: i.id, id: i.id, url: i.url, name: i.name ?? 'Photo' }));
  const [items, setItems] = useState<Item[]>(fromServer(initial)); const [over, setOver] = useState(false); const [drag, setDrag] = useState<number | null>(null); const [confirm, setConfirm] = useState<number | null>(null); const [uploading, setUploading] = useState(0);
  useEffect(() => { if (productId) setItems(fromServer(initial)); }, [initial, productId]);
  useEffect(() => () => items.forEach(i => i.file && URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const report = (next: Item[]) => onFiles?.(next.filter(i => i.file).map(i => i.file!));

  const check = (files: File[]) => { const good: File[] = []; for (const f of files) { if (!OK.includes(f.type)) toast(`${f.name} is not a JPEG, PNG or WebP photo.`, 'error'); else if (f.size > MAX) toast(`${f.name} is over 10 MB.`, 'error'); else good.push(f); } return good; };
  const add = (list: FileList | File[]) => {
    const room = LIMIT - items.length; const good = check(Array.from(list)); if (!good.length) return; if (good.length > room) { toast(`A product can have ${LIMIT} photos. ${room > 0 ? `Adding the first ${room}.` : 'Remove one first.'}`, 'info'); }
    const take = good.slice(0, Math.max(room, 0)); if (!take.length) return;
    if (!productId) { const next = [...items, ...take.map(f => ({ key: `n${Math.random().toString(36).slice(2)}`, url: URL.createObjectURL(f), name: f.name, file: f }))]; setItems(next); report(next); return; }
    const body = new FormData(); take.forEach(f => body.append('file', f)); setUploading(take.length);
    start(async () => { const r = await addProductImages(productId, body); setUploading(0); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); });
  };
  const persist = (next: Item[], message: string) => {
    const prev = items; setItems(next);
    if (!productId) { report(next); return; }
    start(async () => { const r = await saveProductImages(productId, next.map(i => i.id!).filter(Boolean)); if (!r.ok) { setItems(prev); toast(r.message, 'error'); } else { toast(message, 'ok'); router.refresh(); } });
  };
  const move = (from: number, to: number) => { if (to < 0 || to >= items.length || from === to) return; const next = [...items]; const [m] = next.splice(from, 1); next.splice(to, 0, m); persist(next, to === 0 ? 'Main photo changed.' : 'Photo order saved.'); };
  const remove = (i: number) => { const next = items.filter((_, n) => n !== i); if (items[i].file) URL.revokeObjectURL(items[i].url); persist(next, 'Photo removed.'); setConfirm(null); };

  return (<div className="im">
    <div className={`im-drop${over ? ' over' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={e => { setOver(false); if (e.dataTransfer.files.length) { e.preventDefault(); add(e.dataTransfer.files); } }}>
      <UploadCloud size={22} aria-hidden /><b>{items.length ? 'Add more photos' : 'Add photos'}</b><span>Drag photos here, or <button type="button" className="link" onClick={() => input.current?.click()}>choose from your computer</button>. JPEG, PNG or WebP, up to 10 MB each.</span>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
    </div>
    {(items.length > 0 || uploading > 0) && (
      <ul className="im-grid" aria-label="Product photos">
        {items.map((it, i) => (
          <li key={it.key} draggable={!pending} onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} onDragOver={e => { if (drag !== null) e.preventDefault(); }} onDrop={e => { if (drag !== null) { e.preventDefault(); move(drag, i); setDrag(null); } }} className={drag === i ? 'drag' : ''} data-main={i === 0 || undefined}>
            <img src={it.url} alt={`${it.name}${i === 0 ? ', main photo' : ''}`} />
            {i === 0 && <span className="im-main"><Star size={12} aria-hidden />Main</span>}
            <div className="im-tools">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0 || pending} aria-label={`Move ${it.name} earlier`}><ArrowLeft size={15} aria-hidden /></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1 || pending} aria-label={`Move ${it.name} later`}><ArrowRight size={15} aria-hidden /></button>
              {i !== 0 && <button type="button" onClick={() => move(i, 0)} disabled={pending} aria-label={`Make ${it.name} the main photo`}><Star size={15} aria-hidden /></button>}
              <button type="button" className="del" onClick={() => (productId ? setConfirm(i) : remove(i))} disabled={pending} aria-label={`Remove ${it.name}`}><Trash2 size={15} aria-hidden /></button>
            </div>
          </li>))}
        {Array.from({ length: uploading }, (_, n) => <li key={`u${n}`} className="im-wait" aria-label="Uploading"><ImagePlus size={20} aria-hidden /><span>Uploading</span></li>)}
      </ul>)}
    {items.length > 1 && <p className="muted im-hint">Drag to reorder. The first photo is the main one shoppers see.</p>}
    <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title="Remove this photo?" description="It is taken off this product and deleted from your photo library. This cannot be undone."
      footer={<><button className="btn" type="button" onClick={() => setConfirm(null)}>Keep it</button><button className="btn danger" type="button" onClick={() => confirm !== null && remove(confirm)}>Remove photo</button></>}>
      {confirm !== null && items[confirm] && <img className="im-confirm" src={items[confirm].url} alt={items[confirm].name} />}
    </Dialog>
  </div>);
}
