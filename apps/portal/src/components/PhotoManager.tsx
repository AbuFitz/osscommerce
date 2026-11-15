'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Smartphone, ImagePlus, Check } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { startPhoneHandoff, pollPhoneHandoff, closePhoneHandoff, listProductPhotos, uploadPhotos } from '@/app/actions';

type Photo = { id: string; bytes: number };
type Live = { id: string; url: string; svg: string; expiresAt: number; localhost: boolean };

export function PhotoManager({ productId, title, coverUrl, initial }: { productId: string; title: string; coverUrl?: string; initial: Photo[] }) {
  const toast = useToast(); const [photos, setPhotos] = useState<Photo[]>(initial); const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<Live | null>(null); const [state, setState] = useState<string>('waiting'); const [secs, setSecs] = useState(0); const [pending, start] = useTransition(); const file = useRef<HTMLInputElement>(null);
  const merge = useCallback((next: Photo[]) => setPhotos(prev => { const known = new Set(prev.map(p => p.id)); const add = next.filter(p => !known.has(p.id)); if (!add.length) return prev; setFresh(f => new Set([...f, ...add.map(a => a.id)])); return [...prev, ...add]; }), []);

  useEffect(() => { if (!live) return; let stop = false;
    const tick = async () => { if (stop || document.hidden) return; const r = await pollPhoneHandoff(live.id); if (stop || !r.ok) return; setState(r.state); merge(r.files); if (r.state === 'expired' || r.state === 'completed' || r.state === 'cancelled') stop = true; };
    const t = setInterval(tick, 2000); const c = setInterval(() => setSecs(Math.max(0, Math.round((live.expiresAt - Date.now()) / 1000))), 1000); setSecs(Math.max(0, Math.round((live.expiresAt - Date.now()) / 1000))); void tick();
    return () => { stop = true; clearInterval(t); clearInterval(c); }; }, [live, merge]);

  const open = () => start(async () => { const r = await startPhoneHandoff(productId, title); if (!r.ok) { toast(r.message, 'info'); return; } setState('waiting'); setLive(r); });
  const end = async (as: 'completed' | 'cancelled') => { if (live) { await closePhoneHandoff(live.id, as); const f = await listProductPhotos(productId); merge(f); } setLive(null); };
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const received = live ? photos.filter(p => fresh.has(p.id)).length : 0;
  const status = state === 'waiting' ? 'Waiting for your phone to scan' : state === 'connected' ? (received ? `${received} photo${received > 1 ? 's' : ''} received` : 'Phone connected. Take or choose photos.') : state === 'expired' ? 'This link has expired' : 'Closed';

  return (<>
    <div className="pm-bar"><button className="btn lime" type="button" onClick={open} disabled={pending}><Smartphone size={16} aria-hidden />Add from your phone</button>
      <button className="btn" type="button" onClick={() => file.current?.click()}><ImagePlus size={16} aria-hidden />From this computer</button>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { const f = e.target.files; if (!f?.length) return; const body = new FormData(); Array.from(f).forEach(x => body.append('file', x)); e.target.value = ''; start(async () => { const r = await uploadPhotos(productId, body); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) merge(await listProductPhotos(productId)); }); }} /></div>
    {photos.length === 0 && !coverUrl ? <div className="pm-empty"><Smartphone size={22} aria-hidden /><b>No photos yet</b><span>Scan a code with your phone to take or choose photos, and they appear here as you add them.</span></div>
      : <ul className="pm-grid" aria-label="Photos">{coverUrl && <li><img src={coverUrl} alt={`${title}, main`} /><span className="pm-tag">Main</span></li>}{photos.map(p => <li key={p.id} className={fresh.has(p.id) ? 'new' : ''}><img src={`/api/photos/${productId}/${p.id}`} alt={`${title}, photo`} /></li>)}</ul>}
    <Dialog open={!!live} onClose={() => void end('cancelled')} title="Add photos from your phone" description="Point your phone camera at this code. Nothing to sign in to."
      footer={<><button className="btn" type="button" onClick={() => void end('cancelled')}>Cancel link</button><button className="btn primary" type="button" onClick={() => void end('completed')}>{received ? `Done, ${received} added` : 'Done'}</button></>}>
      {live && <div className="qr-wrap">{state === 'waiting' && <div className="qr" aria-label="QR code" dangerouslySetInnerHTML={{ __html: live.svg }} />}
        <div className="qr-status" role="status" aria-live="polite" data-state={state}>{state === 'connected' && <Check size={14} aria-hidden />}{status}</div>
        <p className="muted qr-fine">{state === 'expired' ? 'Close this and make a new code.' : <>The link works on one phone for <span className="num">{mm}</span> and can only add photos to this product.</>}</p>
        {live.localhost && state === 'waiting' && <p className="qr-warn">You are on localhost, so a phone cannot reach this page. Open the portal using your computer&apos;s network address and try again.</p>}
        {state === 'waiting' && <details className="qr-alt"><summary>Can&apos;t scan? Use the link</summary><input readOnly value={live.url} onFocus={e => e.currentTarget.select()} aria-label="Phone link" /></details>}
        {received > 0 && <ul className="pm-grid small" aria-label="Received photos">{photos.filter(p => fresh.has(p.id)).slice(-12).map(p => <li key={p.id} className="new"><img src={`/api/photos/${productId}/${p.id}`} alt="" /></li>)}</ul>}</div>}
    </Dialog>
  </>);
}
