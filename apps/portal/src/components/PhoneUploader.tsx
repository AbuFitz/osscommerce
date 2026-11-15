'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Images, Check, AlertCircle, Loader2 } from 'lucide-react';

type Item = { id: number; url: string; state: 'sending' | 'done' | 'duplicate' | 'error'; note?: string };
type Info = { label: string; remaining: number; received: number; expiresAt: number };

/** Longest edge 2400px, JPEG 0.86: a phone photo is often 5 to 12 MB, and a product page does not need that. Re-encoding also drops location data
 *  in the browser; the server strips metadata again regardless. */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 900_000 && file.type !== 'image/webp') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
  } catch { return file; }
}

export function PhoneUploader({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null); const [err, setErr] = useState<string | null>(null); const [items, setItems] = useState<Item[]>([]); const [secs, setSecs] = useState(0);
  const cam = useRef<HTMLInputElement>(null); const lib = useRef<HTMLInputElement>(null); const n = useRef(0);
  useEffect(() => { (async () => {
    const r = await fetch('/api/handoff/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' }); const j = await r.json().catch(() => ({}));
    if (r.ok) setInfo(j); else setErr(j.error ?? 'This link is not valid.');
  })(); }, [token]);
  useEffect(() => { if (!info) return; const t = setInterval(() => setSecs(Math.max(0, Math.round((info.expiresAt - Date.now()) / 1000))), 1000); setSecs(Math.max(0, Math.round((info.expiresAt - Date.now()) / 1000))); return () => clearInterval(t); }, [info]);

  async function send(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const id = ++n.current, url = URL.createObjectURL(f); setItems(x => [{ id, url, state: 'sending' }, ...x]);
      const set = (p: Partial<Item>) => setItems(x => x.map(i => (i.id === id ? { ...i, ...p } : i)));
      try {
        const body = new FormData(); body.set('token', token); body.set('file', await shrink(f), f.name.replace(/\.\w+$/, '') + '.jpg');
        const r = await fetch('/api/handoff/upload', { method: 'POST', body, cache: 'no-store' }); const j = await r.json().catch(() => ({}));
        if (r.ok) set({ state: j.duplicate ? 'duplicate' : 'done', note: j.duplicate ? 'Already added' : undefined }); else { set({ state: 'error', note: j.error ?? 'Could not add this photo.' }); if (r.status === 410) setErr(j.error); }
      } catch { set({ state: 'error', note: 'No connection. Try again.' }); }
    }
  }
  const sent = items.filter(i => i.state === 'done').length + (info?.received ?? 0);
  if (err) return <section className="hd-card" role="alert"><AlertCircle size={28} aria-hidden /><h1>Cannot add photos</h1><p>{err}</p></section>;
  if (!info) return <section className="hd-card" aria-busy="true"><Loader2 size={28} className="spin" aria-hidden /><p>Connecting to your computer…</p></section>;
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (<>
    <header className="hd-head"><div className="muted">Adding photos to</div><h1>{info.label}</h1></header>
    <section className="hd-card">
      <button className="hd-btn lime" type="button" onClick={() => cam.current?.click()}><Camera size={22} aria-hidden />Take a photo</button>
      <button className="hd-btn" type="button" onClick={() => lib.current?.click()}><Images size={22} aria-hidden />Choose from your photos</button>
      <input ref={cam} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => { void send(e.target.files); e.target.value = ''; }} />
      <input ref={lib} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { void send(e.target.files); e.target.value = ''; }} />
      <p className="muted hd-fine">Photos appear on your computer straight away. Location data is removed. This link works for {mm} more.</p>
    </section>
    {items.length > 0 && <section className="hd-card" aria-live="polite"><h2>{sent} added</h2><ul className="hd-grid">{items.map(i => <li key={i.id} data-state={i.state}><img src={i.url} alt="" />{i.state === 'sending' && <span className="hd-st"><Loader2 size={18} className="spin" aria-label="Sending" /></span>}{(i.state === 'done' || i.state === 'duplicate') && <span className="hd-st ok"><Check size={16} aria-label="Added" /></span>}{i.state === 'error' && <span className="hd-st bad" title={i.note}><AlertCircle size={16} aria-label={i.note ?? 'Failed'} /></span>}</li>)}</ul>{items.some(i => i.state === 'error') && <p className="muted hd-fine">{items.find(i => i.state === 'error')?.note}</p>}</section>}
  </>);
}
