'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { adjustVariantStockAction } from '@/app/actions';
import { REASONS, planAdjust, type Reason } from '@/lib/stock';
import type { StockRow } from '@/lib/gateway';

/** Change one item's stock, and say why. The preview shows exactly what it will become before anything is saved. */
export function AdjustDialog({ row, open, onClose }: { row: StockRow; open: boolean; onClose: () => void }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [mode, setMode] = useState<'add' | 'set'>('add'); const [qty, setQty] = useState(''); const [reason, setReason] = useState<Reason>('received'); const [note, setNote] = useState('');
  useEffect(() => { if (open) { setMode('add'); setQty(''); setReason('received'); setNote(''); } }, [open]);
  const n = qty.trim() === '' ? NaN : Number(qty); const plan = Number.isNaN(n) ? null : planAdjust(row, { mode, qty: n });
  const submit = () => { if (!plan || !plan.ok) return; start(async () => { const r = await adjustVariantStockAction({ variantId: row.variantId, mode, qty: n, reason, note }); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) onClose(); }); };
  return (<Dialog open={open} onClose={() => !pending && onClose()} title={`Adjust stock: ${row.title}${row.variant ? `, ${row.variant}` : ''}`} description={`${row.sku} · ${row.onHand} on hand, ${row.allocated} reserved for open orders.`}
    footer={<><button className="btn" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending || !plan || !plan.ok || (plan.ok && plan.delta === 0)} aria-busy={pending} onClick={submit}>{pending ? 'Saving…' : 'Save change'}</button></>}>
    <form className="fd" onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
      <div className="seg-field" role="radiogroup" aria-label="Change">{([['add', 'Add or remove'], ['set', 'Set to']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} data-on={mode === k || undefined} onClick={() => setMode(k)}>{l}</button>)}</div>
      <div className={`field${qty && plan && !plan.ok ? ' bad' : ''}`}><label htmlFor="as-q">{mode === 'add' ? 'Quantity to add' : 'New stock level'}</label><input id="as-q" inputMode="numeric" autoFocus value={qty} onChange={e => setQty(e.target.value)} aria-invalid={!!(qty && plan && !plan.ok)} placeholder={mode === 'add' ? 'For example 12, or -3 to remove' : 'For example 40'} />
        {qty && plan && !plan.ok ? <p className="ferr" role="alert">{plan.error}</p> : plan && plan.ok ? <p className="fhint" aria-live="polite"><b>{row.onHand}</b> → <b>{plan.to}</b> on hand ({plan.delta > 0 ? '+' : ''}{plan.delta})</p> : <p className="fhint muted">{mode === 'add' ? 'Use a minus sign to remove stock.' : 'This replaces what the system holds.'}</p>}</div>
      <div className="field"><label htmlFor="as-r">Reason</label><select id="as-r" value={reason} onChange={e => setReason(e.target.value as Reason)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="as-n">Note <span className="muted">(optional)</span></label><input id="as-n" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: pallet from the kiln" /></div>
    </form></Dialog>);
}
