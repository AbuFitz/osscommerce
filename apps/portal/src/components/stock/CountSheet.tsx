'use client';
import { useMemo, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Search } from 'lucide-react';
import { applyStockCountAction } from '@/app/actions';
import { Media } from '@/components/art';
import { planCount } from '@/lib/stock';
import type { StockRow } from '@/lib/gateway';

/** A shelf count. Type what you find, item by item; only items you fill in are checked. Nothing changes until you review and apply. */
export function CountSheet({ rows }: { rows: StockRow[] }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [q, setQ] = useState(''); const [vals, setVals] = useState<Record<string, string>>({}); const [review, setReview] = useState(false); const [note, setNote] = useState('');
  const lines = useMemo(() => Object.entries(vals).filter(([, v]) => v.trim() !== '').map(([variantId, v]) => ({ variantId, counted: Number(v) })), [vals]);
  const plan = useMemo(() => planCount(rows.map(r => ({ variantId: r.variantId, onHand: r.onHand, allocated: r.allocated })), lines), [rows, lines]);
  const bad = new Map(plan.problems.map(p => [p.variantId, p.error])); const byId = new Map(rows.map(r => [r.variantId, r])); const change = new Map(plan.changes.map(c => [c.variantId, c]));
  const shown = rows.filter(r => `${r.title} ${r.variant ?? ''} ${r.sku}`.toLowerCase().includes(q.trim().toLowerCase()));
  const apply = () => start(async () => { const r = await applyStockCountAction(plan.changes.length ? lines.filter(l => change.has(l.variantId) || !bad.has(l.variantId)) : lines, note); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { setVals({}); setReview(false); setNote(''); } });
  return (<>
    <div className="cl-bar"><div className="cl-search"><Search size={16} aria-hidden /><input type="search" aria-label="Search items" placeholder="Search by name or SKU" value={q} onChange={e => setQ(e.target.value)} /></div>
      <span className="muted" aria-live="polite">{lines.length} counted · {plan.changes.length} differ</span></div>
    <div className="w tw">
      <table className="t"><thead><tr><th scope="col">Item</th><th scope="col" className="r">System says</th><th scope="col" className="r">You counted</th><th scope="col">Difference</th></tr></thead>
        <tbody>{shown.map(r => { const c = change.get(r.variantId); const err = bad.get(r.variantId); const has = (vals[r.variantId] ?? '').trim() !== ''; return (<tr key={r.variantId} className={err ? 'cs-bad' : c ? 'cs-diff' : ''}>
          <td><span className="cl-name"><Media src={r.imageUrl} alt="" size={40} /><span><b style={{ fontWeight: 600 }}>{r.title}</b>{r.variant && <span className="muted"> {r.variant}</span>}<div className="mono muted">{r.sku}</div></span></span></td>
          <td className="r num">{r.onHand}</td>
          <td className="r"><input className="cs-in" inputMode="numeric" aria-label={`Counted ${r.title}${r.variant ? ` ${r.variant}` : ''}`} value={vals[r.variantId] ?? ''} onChange={e => setVals(v => ({ ...v, [r.variantId]: e.target.value.replace(/[^\d]/g, '') }))} placeholder="—" aria-invalid={!!err} /></td>
          <td>{err ? <span className="ferr" role="alert" style={{ fontSize: 13 }}>{err}</span> : c ? <b className={`num ${c.to > c.from ? 'cs-up' : 'cs-down'}`}>{c.to > c.from ? '+' : ''}{c.to - c.from}</b> : has ? <span className="muted">Matches</span> : <span className="muted">Not counted</span>}</td></tr>); })}</tbody></table>
    </div>
    <div className="cs-bar"><span>{plan.changes.length ? `${plan.changes.length} item${plan.changes.length > 1 ? 's' : ''} will change` : lines.length ? 'Everything you counted matches' : 'Fill in what you count'}</span>
      <button type="button" className="btn primary" disabled={!lines.length || pending} onClick={() => setReview(true)}>Review count</button></div>
    <Dialog open={review} onClose={() => !pending && setReview(false)} title="Apply this count?" description="Each changed item is set to what you counted, and the change is recorded as a stock count."
      footer={<><button className="btn" type="button" onClick={() => setReview(false)} disabled={pending}>Back</button><button className="btn primary" type="button" disabled={pending || (plan.changes.length === 0)} aria-busy={pending} onClick={apply}>{pending ? 'Saving…' : `Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`}</button></>}>
      {plan.changes.length === 0 ? <p className="muted">Nothing differs from what the system holds, so there is nothing to apply.</p> : <ul className="fq" aria-label="Changes">{plan.changes.map(c => { const r = byId.get(c.variantId)!; return <li key={c.variantId}><span className="t"><b>{r.title}{r.variant ? `, ${r.variant}` : ''}</b><span className="muted mono">{r.sku}</span></span><span className="num">{c.from} → <b>{c.to}</b> ({c.to > c.from ? '+' : ''}{c.to - c.from})</span></li>; })}</ul>}
      {plan.problems.length > 0 && <p className="note">{plan.problems.length} item{plan.problems.length > 1 ? 's' : ''} cannot be applied and will be left alone. See the red rows.</p>}
      <div className="field"><label htmlFor="cs-n">Note <span className="muted">(optional)</span></label><input id="cs-n" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: November stocktake" /></div>
    </Dialog>
  </>);
}
