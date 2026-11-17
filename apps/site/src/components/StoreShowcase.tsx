'use client';
import { useId, useState } from 'react';
import { Browser, Phone } from './Frames';
import { STORES, StoreMock } from './stores';
/** Pick a business and see its store. Different design, same platform underneath. */
export function StoreShowcase() {
  const id = useId(); const [i, setI] = useState(0); const s = STORES[i];
  const key = (e: React.KeyboardEvent) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = (i + d + STORES.length) % STORES.length; setI(n); document.getElementById(`${id}-${n}`)?.focus(); };
  return (<div>
    <div className="shw-t" role="tablist" aria-label="Example businesses" onKeyDown={key}>{STORES.map((x, n) => <button key={x.id} id={`${id}-${n}`} role="tab" type="button" aria-selected={n === i} tabIndex={n === i ? 0 : -1} aria-controls={`${id}-p`} onClick={() => setI(n)}>{x.label}</button>)}</div>
    <div id={`${id}-p`} role="tabpanel" aria-labelledby={`${id}-${i}`}>
      <div className="shw-s"><Browser url={s.url}><StoreMock s={s} /></Browser><Phone><StoreMock s={s} /></Phone></div>
      <p className="shw-c"><b>{s.name}</b><span>{s.kind}. {s.note}</span></p>
    </div></div>);
}
