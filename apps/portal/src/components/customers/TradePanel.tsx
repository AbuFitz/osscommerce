'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { saveTradePricingAction, setTradeCustomerAction } from '@/app/actions';
import type { TradePricing } from '@/lib/gateway';

/** Set the trade discount and see who gets it. Customers are added from their own page (or removed here). */
export function TradePanel({ trade }: { trade: TradePricing }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [pct, setPct] = useState(String(trade.percent || 10)); const [on, setOn] = useState(trade.enabled);
  const n = Number(pct); const bad = !Number.isFinite(n) || n < 1 || n > 90;
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, done?: () => void) => start(async () => { const r = await fn(); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) done?.(); });
  return (<>
    <button className="btn" type="button" onClick={() => { setPct(String(trade.percent || 10)); setOn(trade.enabled); setOpen(true); }}>Trade pricing{trade.enabled ? <span className="badge ok" style={{ marginLeft: 8 }}>{trade.percent}% off</span> : null}</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Trade pricing" description="A percentage off for customers you mark as trade. Your shop's prices stay the same for everyone else; trade customers see the reduction in their basket."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Close</button><button className="btn primary" type="button" disabled={pending || bad} onClick={() => run(() => saveTradePricingAction(n, on))}>{pending ? 'Saving…' : 'Save'}</button></>}>
      <div className="stack">
        <label className="check1"><input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} /> Trade pricing is on</label>
        <div className="field"><label htmlFor="tp-pct">Discount for trade customers (%)</label><input id="tp-pct" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value.replace(/[^0-9.]/g, ''))} aria-invalid={bad} style={{ maxWidth: 120 }} />{bad && <p className="ferr">Choose from 1 to 90.</p>}</div>
        <div><h3 style={{ margin: '4px 0 8px', fontSize: 15 }}>Trade customers ({trade.members.length})</h3>
          {trade.members.length === 0 ? <p className="muted" style={{ margin: 0 }}>None yet. Open a customer and choose “Trade customer”.</p> : <ul className="rows" style={{ listStyle: "none", padding: 0, margin: 0 }}>{trade.members.map(m => <li key={m.id} className="row"><span className="t"><b>{m.name}</b><span>{m.email}</span></span><button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setTradeCustomerAction(m.id, false))}>Remove</button></li>)}</ul>}</div>
      </div>
    </Dialog>
  </>);
}

/** On a customer's page: mark them as trade, or not. */
export function TradeToggle({ id, member, enabled }: { id: string; member: boolean; enabled: boolean }) {
  const toast = useToast(); const [pending, start] = useTransition();
  return (<><p className="muted" style={{ margin: '0 0 10px', fontSize: 13.5 }}>{member ? (enabled ? 'Gets your trade discount on every order.' : 'Marked as trade, but trade pricing is switched off.') : 'Give wholesale customers your trade discount.'}</p>
    <button className="btn sm" type="button" disabled={pending} aria-pressed={member} onClick={() => start(async () => { const r = await setTradeCustomerAction(id, !member); toast(r.message, r.ok ? 'ok' : 'error'); })}>{pending ? 'Saving…' : member ? 'Remove trade status' : 'Mark as trade customer'}</button></>);
}
