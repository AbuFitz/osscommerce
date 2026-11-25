'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEMO } from '@/lib/env';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';

/** Disclosure popover. Membership is re-validated server-side on every request; this list is only a view. */
export function Switcher({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const m = matchMedia('(max-width:767px)'); const f = () => setNarrow(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useEffect(() => {
    if (!open || narrow) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, narrow]);
  return (
    <div className="pop" ref={box}>
      <button className="switch" type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
        <span className="mk" aria-hidden>{name[0]}</span><span><small>Store</small><b>{name}</b></span><ChevronsUpDown size={15} aria-hidden />
      </button>
      {open && (() => { const list = (<>
          <div className="pop-item on"><span className="mk" aria-hidden>{name[0]}</span><span style={{ flex: 1 }}>{name}</span><Check size={15} aria-hidden /></div>
          <a className="pop-item" href="mailto:hello@onesimplesite.co.uk?subject=Another%20store"><span className="ic lime" style={{ width: 32, height: 32 }}><Plus size={15} aria-hidden /></span><span style={{ flex: 1 }}>Add another store</span></a>
          {DEMO && <><div className="pop-sep" /><div className="pop-lab">Demo view</div>
          {[['new', 'New store'], ['setup', 'Setting up'], ['live', 'Live store']].map(([k, l]) => <a key={k} className="pop-item sm" href={`/demo?state=${k}&back=${encodeURIComponent(path)}`}>{l}</a>)}</>}
</>);
        return narrow ? <Dialog open onClose={() => setOpen(false)} title="Your stores"><div className="pop-sheet" onClick={() => setOpen(false)}>{list}</div></Dialog> : <div className="pop-menu" role="group" aria-label="Your stores">{list}</div>; })()}
    </div>
  );
}
