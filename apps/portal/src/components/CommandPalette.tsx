'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { searchAll, type SearchHit } from '@/app/actions';

type Cmd = { label: string; href: string; hint?: string; group: string };
const PAGES: Cmd[] = [
  ['Overview', '/', 'g h'], ['Orders', '/orders', 'g o'], ['Products', '/products', 'g p'], ['Collections', '/collections'], ['Inventory', '/inventory', 'g i'], ['Customers', '/customers', 'g c'],
  ['Discounts', '/discounts', 'g d'], ['Analytics', '/analytics', 'g a'], ['Live view', '/analytics/live'], ['Automations', '/automations'], ['Storefront', '/storefront'], ['Content', '/content'], ['Help', '/support'],
  ['Settings', '/settings', 'g s'], ['Payments settings', '/settings/payments'], ['Shipping and tax', '/settings/shipping'], ['Postcode check', '/settings/shipping'], ['Integrations', '/settings/integrations'], ['Team and access', '/settings/team'], ['Preferences', '/settings/preferences'],
].map(([label, href, hint]) => ({ label, href, hint, group: 'Go to' }));
const ACTIONS: Cmd[] = [
  { label: 'Orders waiting to ship', href: '/orders?filter=unfulfilled', group: 'Shortcuts' }, { label: 'Refunded orders', href: '/orders?filter=refunded', group: 'Shortcuts' },
];
export const SHORTCUTS: Record<string, string> = { h: '/', o: '/orders', p: '/products', i: '/inventory', c: '/customers', d: '/discounts', a: '/analytics', s: '/settings' };
const typing = (t: EventTarget | null) => { const e = t as HTMLElement | null; return !!e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName)); };

/** ⌘K / Ctrl+K or "/" opens it. "g" then a letter jumps to a page. Everything it opens is a normal link, so nothing here bypasses the server's checks. */
export function CommandPalette() {
  const router = useRouter(); const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [hits, setHits] = useState<SearchHit[]>([]); const [i, setI] = useState(0); const box = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let g = 0;
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); return; }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      if (e.key === '/') { e.preventDefault(); setOpen(true); return; }
      if (e.key === 'g') { g = Date.now(); return; }
      if (g && Date.now() - g < 1200 && SHORTCUTS[e.key]) { g = 0; router.push(SHORTCUTS[e.key]); }
    };
    const evt = () => setOpen(true); addEventListener('keydown', key); addEventListener('oss:palette', evt);
    return () => { removeEventListener('keydown', key); removeEventListener('oss:palette', evt); };
  }, [router]);
  useEffect(() => { const d = box.current; if (!d) return; if (open && !d.open) { d.showModal(); setQ(''); setHits([]); setI(0); setTimeout(() => input.current?.focus(), 0); } if (!open && d.open) d.close(); }, [open]);
  useEffect(() => { if (!open) return; const t = setTimeout(async () => setHits(await searchAll(q)), 160); return () => clearTimeout(t); }, [q, open]);
  const rows: Cmd[] = useMemo(() => {
    const t = q.trim().toLowerCase(); const m = (c: Cmd) => !t || c.label.toLowerCase().includes(t);
    const base = [...(t ? [] : ACTIONS), ...PAGES].filter(m).slice(0, t ? 6 : 12);
    return [...base, ...hits.map(h => ({ label: h.title, hint: h.sub, href: h.href, group: h.kind + 's' }))];
  }, [q, hits]);
  useEffect(() => setI(0), [q]);
  const go = (c?: Cmd) => { setOpen(false); if (c) router.push(c.href); else if (q.trim()) router.push(`/orders?q=${encodeURIComponent(q.trim())}`); };
  let last = '';
  return (<dialog ref={box} className="cmdk" aria-label="Search and jump" onCancel={e => { e.preventDefault(); setOpen(false); }} onClick={e => { if (e.target === box.current) setOpen(false); }}
    onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, rows.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); go(rows[i]); } }}>
    <div className="cmdk-in">
      <div className="cmdk-q"><Search size={18} aria-hidden /><input ref={input} role="combobox" aria-expanded aria-controls="cmdk-list" aria-activedescendant={rows[i] ? `cmdk-${i}` : undefined} value={q} onChange={e => setQ(e.target.value)} placeholder="Search orders, products, customers, or jump to a page" aria-label="Search" autoComplete="off" /><kbd>Esc</kbd></div>
      <ul id="cmdk-list" role="listbox" className="cmdk-l">
        {rows.length === 0 && <li className="cmdk-none">Nothing found for “{q}”. Press Enter to search orders.</li>}
        {rows.map((c, n) => { const head = c.group !== last ? (last = c.group) : null; return (<li key={c.group + c.href + c.label} role="presentation">{head && <div className="cmdk-g">{head}</div>}
          <button id={`cmdk-${n}`} role="option" aria-selected={n === i} type="button" className="cmdk-r" onMouseMove={() => setI(n)} onClick={() => go(c)}><span>{c.label}</span>{c.hint && <small>{c.hint.includes(' ') && c.hint.length === 3 ? <><kbd>{c.hint[0]}</kbd> then <kbd>{c.hint[2]}</kbd></> : c.hint}</small>}</button></li>); })}
      </ul>
      <div className="cmdk-f"><span><ArrowUp size={13} aria-hidden /><ArrowDown size={13} aria-hidden /> move</span><span><CornerDownLeft size={13} aria-hidden /> open</span><span><kbd>/</kbd> search anywhere</span></div>
    </div>
  </dialog>);
}
