'use client';
import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@oss-commerce/ui';
import { saveMenuAction } from '@/app/actions';
import { MAX_MENU_ITEMS, validateMenu, type MenuItem, type MenuView } from '@/lib/site-content';

/** One menu. Reorder with the arrows (no dragging needed, so it works the same on a phone), then publish. */
export function MenuEditor({ menu, hint }: { menu: MenuView; hint: string }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [items, setItems] = useState<MenuItem[]>(menu.items);
  const v = validateMenu(menu.key, items); const changed = JSON.stringify(items) !== JSON.stringify(menu.publishedItems); const set = (i: number, p: Partial<MenuItem>) => setItems(x => x.map((it, k) => k === i ? { ...it, ...p } : it));
  const move = (i: number, d: -1 | 1) => setItems(x => { const j = i + d; if (j < 0 || j >= x.length) return x; const y = [...x]; [y[i], y[j]] = [y[j], y[i]]; return y; });
  const save = (publish: boolean) => start(async () => { const r = await saveMenuAction(menu.key, items, publish); toast(r.message, r.ok ? 'ok' : 'error'); });
  return (<section className="w fd" aria-labelledby={`mn-${menu.key}`}>
    <div className="wh"><h2 id={`mn-${menu.key}`}>{menu.title}</h2><span className={`badge ${menu.status === 'published' && !changed ? 'ok' : 'warn'}`}>{menu.status === 'not_set_up' && !changed ? 'Not set up' : menu.status === 'published' && !changed ? 'Published' : 'Unpublished changes'}</span></div>
    <p className="muted" style={{ margin: '0 0 8px', fontSize: 13.5 }}>{hint}</p>
    {items.length === 0 ? <p className="muted">No links yet.</p> : <ul className="mn-list" aria-label={`${menu.title} links`}>{items.map((it, i) => (
      <li key={i}><div className="mn-fields"><label className="sr" htmlFor={`${menu.key}-l${i}`}>Link {i + 1} name</label><input id={`${menu.key}-l${i}`} value={it.label} maxLength={30} placeholder="Shop" onChange={e => set(i, { label: e.target.value })} />
        <label className="sr" htmlFor={`${menu.key}-u${i}`}>Link {i + 1} address</label><input id={`${menu.key}-u${i}`} value={it.link} inputMode="url" placeholder="/collections/all" onChange={e => set(i, { link: e.target.value })} /></div>
        <div className="mn-btns"><button type="button" className="iconbtn" aria-label={`Move link ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} aria-hidden /></button><button type="button" className="iconbtn" aria-label={`Move link ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} aria-hidden /></button><button type="button" className="iconbtn" aria-label={`Remove link ${i + 1}`} onClick={() => setItems(x => x.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden /></button></div></li>))}</ul>}
    {items.length < MAX_MENU_ITEMS && <button type="button" className="btn sm" onClick={() => setItems(x => [...x, { label: '', link: '' }])}><Plus size={14} aria-hidden />Add a link</button>}
    {!v.ok && items.length > 0 && <p className="note" aria-live="polite">{v.message}</p>}
    <div className="acts" style={{ marginTop: 6 }}><button className="btn primary" type="button" disabled={pending || !v.ok} onClick={() => save(true)} aria-busy={pending}>{pending ? 'Saving…' : 'Publish'}</button><button className="btn" type="button" disabled={pending || !v.ok} onClick={() => save(false)}>Save draft</button></div>
  </section>);
}
