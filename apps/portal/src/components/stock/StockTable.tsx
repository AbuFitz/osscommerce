'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Media } from '@/components/art';
import { AdjustDialog } from './AdjustStock';
import type { StockRow } from '@/lib/gateway';

const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['low', 'Low'], ['out', 'Out of stock'], ['other', 'Back order or not counted']] as const;
type F = (typeof FILTERS)[number][0];
const label = { ok: 'In stock', low: 'Low', out: 'Out of stock', backorder: 'Back order', untracked: 'Not counted' } as const; const tone = { ok: 'ok', low: 'warn', out: 'bad', backorder: 'info', untracked: '' } as const;
const test = (r: StockRow, f: F) => f === 'all' || (f === 'attention' && (r.status === 'low' || r.status === 'out')) || (f === 'low' && r.status === 'low') || (f === 'out' && r.status === 'out') || (f === 'other' && (r.status === 'backorder' || r.status === 'untracked'));

/** Every item you sell, one row each, with what is on the shelf, what is promised to open orders, and what can still be sold. */
export function StockTable({ rows }: { rows: StockRow[] }) {
  const [q, setQ] = useState(''); const [f, setF] = useState<F>('all'); const [adj, setAdj] = useState<StockRow | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, rows.filter(r => test(r, k)).length])) as Record<F, number>, [rows]);
  const shown = useMemo(() => rows.filter(r => test(r, f) && `${r.title} ${r.variant ?? ''} ${r.sku}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, f, q]);
  return (<>
    <div className="cl-bar"><div className="cl-search"><Search size={16} aria-hidden /><input type="search" aria-label="Search stock" placeholder="Search by name or SKU" value={q} onChange={e => setQ(e.target.value)} /></div></div>
    <div className="cl-seg" role="tablist" aria-label="Stock filter">{FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)}>{l}<span className="num">{counts[k]}</span></button>)}</div>
    <div className="w tw">
      {shown.length === 0 ? <p className="muted" style={{ padding: 24, textAlign: 'center' }}>{q ? `Nothing matches “${q}”.` : 'Nothing in this group.'}</p> : <>
        <table className="t"><thead><tr><th scope="col">Item</th><th scope="col" className="r">On hand</th><th scope="col" className="r">Reserved</th><th scope="col">Available</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>{shown.map(r => (<tr key={r.variantId}>
            <td><Link href={`/inventory/${r.variantId}`} className="cl-name"><Media src={r.imageUrl} alt="" size={44} /><span><b style={{ fontWeight: 600 }}>{r.title}</b>{r.variant && <span className="muted"> {r.variant}</span>}<div className="mono muted">{r.sku}{!r.published && ' · not on sale'}</div></span></Link></td>
            <td className="r num">{r.onHand}</td><td className="r num">{r.allocated}</td>
            <td style={{ minWidth: 190 }}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="num" style={{ minWidth: 24 }}>{r.tracked ? r.available : '—'}</span><span className={`badge ${tone[r.status]}`}>{label[r.status]}</span></span></td>
            <td className="r"><button type="button" className="btn sm" onClick={() => setAdj(r)}><SlidersHorizontal size={14} aria-hidden />Adjust</button></td></tr>))}</tbody></table>
        <div className="cards">{shown.map(r => <Link key={r.variantId} href={`/inventory/${r.variantId}`}><b>{r.title}{r.variant ? `, ${r.variant}` : ''}</b><b className="num">{r.tracked ? r.available : '—'}</b><span className="muted mono">{r.sku} · {r.onHand} on hand · {r.allocated} reserved</span><span style={{ textAlign: 'right' }}><span className={`badge ${tone[r.status]}`}>{label[r.status]}</span></span></Link>)}</div></>}
    </div>
    {adj && <AdjustDialog row={adj} open onClose={() => setAdj(null)} />}
  </>);
}
