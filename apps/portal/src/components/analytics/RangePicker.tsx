'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Check, ChevronDown, Download } from 'lucide-react';
import { PRESETS } from '@/lib/analytics';

/** Date range for the whole page. Presets or a custom start and end; the choice lives in the address so it can be shared and survives a refresh. */
export function RangePicker({ label, from, to, today }: { label: string; from: string; to: string; today: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams(); const [open, setOpen] = useState(false); const [f, setF] = useState(from), [t, setT] = useState(to); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setF(from); setT(to); }, [from, to]);
  useEffect(() => { if (!open) return; const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', off); document.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); }; }, [open]);
  const go = (q: Record<string, string>) => { const n = new URLSearchParams(sp.toString()); n.delete('range'); n.delete('from'); n.delete('to'); for (const [k, v] of Object.entries(q)) n.set(k, v); router.replace(`${path}?${n}`, { scroll: false }); setOpen(false); };
  const preset = PRESETS.find(p => p[1] === label)?.[0]; const bad = !f || !t || f > t || t > today;
  const exportHref = `/analytics/export?${new URLSearchParams(preset ? { range: preset } : { from, to })}`;
  return (<div className="an-rp" ref={box}>
    <button type="button" className="btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}><CalendarDays size={16} aria-hidden />{label}<ChevronDown size={15} aria-hidden /></button>
    <a className="btn" href={exportHref} download><Download size={16} aria-hidden />Export CSV</a>
    {open && (<div className="an-pop" role="dialog" aria-label="Choose dates">
      <ul className="an-presets">{PRESETS.map(p => <li key={p[0]}><button type="button" onClick={() => go({ range: p[0] })} aria-current={preset === p[0] || undefined}>{p[1]}{preset === p[0] && <Check size={15} aria-hidden />}</button></li>)}</ul>
      <form className="an-custom" onSubmit={e => { e.preventDefault(); if (!bad) go({ from: f, to: t }); }}>
        <p className="mono-l">Custom range</p>
        <label>From<input type="date" value={f} max={t || today} onChange={e => setF(e.target.value)} /></label>
        <label>To<input type="date" value={t} min={f} max={today} onChange={e => setT(e.target.value)} /></label>
        {bad && <small className="err">Choose a start on or before the end, and not in the future.</small>}
        <button className="btn dark" type="submit" disabled={bad}>Apply</button>
      </form>
    </div>)}
  </div>);
}
