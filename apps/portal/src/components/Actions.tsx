'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { FormDialog } from './FormDialog';
import { money } from '@/lib/format';
import type { MutationResult, Member, OrderLine } from '@/lib/gateway';
import { addOrderNote, cancelOrder, decideGrant, fulfilOrder, inviteMember, refundOrder, rollbackTheme } from '@/app/actions';

/** Runs a server action, then tells the person the real outcome. Failures say nothing changed. */
export function useRun() {
  const toast = useToast(); const [pending, start] = useTransition();
  const run = (fn: () => Promise<MutationResult>, done?: () => void) => start(async () => {
    const r = await fn(); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) done?.();
  });
  return { run, pending };
}
function useDialog() { const [open, setOpen] = useState(false); return { open, show: () => setOpen(true), hide: () => setOpen(false) }; }

/** Send everything, or choose how many of each item went in this parcel. Items already sent are not offered again. */
export function FulfilAction({ orderId, number, lines }: { orderId: string; number: number; lines: OrderLine[] }) {
  const d = useDialog(); const { run, pending } = useRun(); const [trk, setTrk] = useState('');
  const left = lines.map(l => ({ sku: l.sku, title: l.variant ? `${l.title} (${l.variant})` : l.title, left: l.qty - (l.sent ?? 0) })).filter(l => l.left > 0);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(left.map(l => [l.sku, l.left])));
  useEffect(() => { if (d.open) setQty(Object.fromEntries(left.map(l => [l.sku, l.left]))); }, [d.open]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = left.reduce((s, l) => s + (qty[l.sku] ?? 0), 0); const all = left.every(l => (qty[l.sku] ?? 0) === l.left); const sentBefore = lines.some(l => (l.sent ?? 0) > 0);
  const set = (sku: string, n: number, max: number) => setQty(q => ({ ...q, [sku]: Math.max(0, Math.min(max, n)) }));
  return (<>
    <button className="btn lime" type="button" onClick={d.show}>{sentBefore ? 'Fulfil the rest' : 'Mark as fulfilled'}</button>
    <Dialog open={d.open} onClose={d.hide} title={`Fulfil order #${number}`} description="The customer is emailed a shipping confirmation with the tracking link."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={pending || total === 0} onClick={() => run(() => fulfilOrder(orderId, trk || undefined, all ? undefined : left.map(l => ({ sku: l.sku, qty: qty[l.sku] ?? 0 }))), d.hide)}>{pending ? 'Saving…' : all ? 'Mark as fulfilled' : `Send ${total} item${total === 1 ? '' : 's'}`}</button></>}>
      <ul className="fq" aria-label="Items to send">{left.map(l => (
        <li key={l.sku}><span className="t"><b>{l.title}</b><span className="muted">{l.left} to send</span></span>
          <div className="stepper" role="group" aria-label={`Quantity of ${l.title} to send`}><button type="button" onClick={() => set(l.sku, (qty[l.sku] ?? 0) - 1, l.left)} disabled={(qty[l.sku] ?? 0) <= 0} aria-label="One fewer">−</button><output aria-live="polite">{qty[l.sku] ?? 0}</output><button type="button" onClick={() => set(l.sku, (qty[l.sku] ?? 0) + 1, l.left)} disabled={(qty[l.sku] ?? 0) >= l.left} aria-label="One more">+</button></div></li>))}</ul>
      {!all && total > 0 && <p className="note">This sends part of the order. You can fulfil the rest later.</p>}
      <div className="field"><label htmlFor="trk">Tracking number <span className="muted">(optional)</span></label><input id="trk" autoComplete="off" maxLength={120} value={trk} onChange={e => setTrk(e.target.value)} /></div>
    </Dialog>
  </>);
}

const REASONS = ['Customer asked to cancel', 'Out of stock', 'Could not deliver to that address', 'Suspected fraud', 'Other'];
/** For orders that have not shipped. Stock is released straight away; the customer can be refunded in the same step. */
export function CancelAction({ orderId, number, paid }: { orderId: string; number: number; paid: boolean }) {
  const d = useDialog(); const { run, pending } = useRun(); const [reason, setReason] = useState(REASONS[0]); const [more, setMore] = useState(''); const [refund, setRefund] = useState(true);
  const text = reason === 'Other' && more.trim() ? more.trim() : reason;
  return (<>
    <button className="btn ghost" type="button" onClick={d.show}>Cancel order</button>
    <Dialog open={d.open} onClose={d.hide} title={`Cancel order #${number}?`} description="Nothing has been sent yet. The items go back into stock."
      footer={<><button className="btn" type="button" onClick={d.hide} disabled={pending}>Keep order</button><button className="btn danger" type="button" disabled={pending || (reason === 'Other' && !more.trim())} onClick={() => run(() => cancelOrder({ orderId, reason: text, refund: paid && refund }), d.hide)}>{pending ? 'Cancelling…' : paid && refund ? 'Cancel and refund' : 'Cancel order'}</button></>}>
      <div className="field"><label htmlFor="cr">Reason</label><select id="cr" value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select></div>
      {reason === 'Other' && <div className="field"><label htmlFor="cm">Tell us more</label><input id="cm" maxLength={160} value={more} onChange={e => setMore(e.target.value)} /></div>}
      {paid ? <label className="check1"><input type="checkbox" checked={refund} onChange={e => setRefund(e.target.checked)} /> Refund the customer in full, and return our platform fee on it</label> : <p className="note">This order was not paid, so there is nothing to refund.</p>}
      {paid && !refund && <p className="note">The order is cancelled but the customer keeps being charged until you refund it.</p>}
    </Dialog>
  </>);
}

/** A private note on the order. Only the team sees it; it appears in the timeline with who wrote it. */
export function NoteForm({ orderId }: { orderId: string }) {
  const { run, pending } = useRun(); const [note, setNote] = useState('');
  return (<form className="notef" onSubmit={e => { e.preventDefault(); if (note.trim()) run(() => addOrderNote(orderId, note), () => setNote('')); }}>
    <label htmlFor="on" className="sr">Add a private note</label>
    <textarea id="on" rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a private note for your team" />
    <div className="notef-row"><small className="muted">Only your team can see notes.</small><button className="btn" type="submit" disabled={pending || !note.trim()} aria-busy={pending}>{pending ? 'Adding…' : 'Add note'}</button></div>
  </form>);
}

export function RefundAction({ orderId, number, totalMinor, refundedMinor, feeBp }: { orderId: string; number: number; totalMinor: number; refundedMinor: number; feeBp: number }) {
  const d = useDialog(); const { run, pending } = useRun();
  const left = totalMinor - refundedMinor;
  const [full, setFull] = useState(true); const [amt, setAmt] = useState(''); const [restock, setRestock] = useState(true); const [fee, setFee] = useState(true); const [reason, setReason] = useState('Customer request');
  const minor = full ? left : Math.round(parseFloat(amt || '0') * 100);
  const bad = !Number.isFinite(minor) || minor <= 0 || minor > left;
  return (<>
    <button className="btn ghost" type="button" onClick={d.show}>Refund</button>
    <Dialog open={d.open} onClose={d.hide} title={`Refund order #${number}`} description={`${money(left)} can still be refunded. This goes back to the customer's card.`}
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={bad || pending} onClick={() => run(() => refundOrder({ orderId, amountMinor: minor, reason, restock, refundFee: fee }), d.hide)}>{pending ? 'Sending…' : `Refund ${bad ? '' : money(minor)}`}</button></>}>
      <fieldset className="radios"><legend className="sr">Refund amount</legend>
        <label><input type="radio" name="amt" checked={full} onChange={() => setFull(true)} /> Full remaining amount ({money(left)})</label>
        <label><input type="radio" name="amt" checked={!full} onChange={() => setFull(false)} /> Part refund</label></fieldset>
      {!full && <div className="field"><label htmlFor="ra">Amount (£)</label><input id="ra" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={bad} aria-describedby="ra-h" /><small id="ra-h" className={bad ? 'err' : 'muted'}>{bad ? `Enter an amount up to ${money(left)}.` : 'Tax and shipping are allocated automatically.'}</small></div>}
      <div className="field"><label htmlFor="rr">Reason</label><select id="rr" value={reason} onChange={e => setReason(e.target.value)}><option>Customer request</option><option>Item damaged</option><option>Out of stock</option><option>Other</option></select></div>
      <label className="check1"><input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} /> Return items to stock</label>
      <label className="check1"><input type="checkbox" checked={fee} onChange={e => setFee(e.target.checked)} /> Return our {(feeBp / 100).toFixed(2)}% platform fee on this refund</label>
      <p className="note">Stripe may keep its own processing fee. We show Pending until Stripe confirms the refund, so confirm once.</p>
    </Dialog>
  </>);
}

export function InviteAction() {
  return <FormDialog trigger="Invite member" triggerClass="btn primary" title="Invite a team member" description="They get an email invitation. You choose exactly what they can do."
    fields={[{ name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@example.com' },
      { name: 'role', label: 'Role', type: 'select', required: true, value: 'fulfilment', hint: 'You can change this later. Owners cannot be invited here.', options: [{ value: 'manager', label: 'Manager: products, orders, discounts' }, { value: 'fulfilment', label: 'Fulfilment: orders and stock' }, { value: 'analyst', label: 'Analyst: read-only reports' }] }]}
    submit="Send invitation" onSubmit={v => inviteMember(v.email.trim(), v.role as Member['role'])} />;
}

export function RollbackAction({ version }: { version: string }) {
  const d = useDialog(); const { run, pending } = useRun();
  return (<>
    <button className="btn sm" type="button" onClick={d.show}>Roll back</button>
    <Dialog open={d.open} onClose={d.hide} title={`Roll back to v${version}?`} description="Your live storefront switches to this version within about a minute. Orders and products are not affected."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => rollbackTheme(version), d.hide)}>{pending ? 'Rolling back…' : 'Roll back'}</button></>}><span /></Dialog>
  </>);
}

export function GrantAction({ id, state }: { id: string; state: 'pending' | 'active' }) {
  const { run, pending } = useRun();
  return state === 'pending' ? (
    <div className="acts" style={{ marginTop: 10 }}>
      <button className="btn sm primary" type="button" disabled={pending} onClick={() => run(() => decideGrant(id, 'approve'))}>Approve</button>
      <button className="btn sm" type="button" disabled={pending} onClick={() => run(() => decideGrant(id, 'decline'))}>Decline</button></div>
  ) : <div style={{ marginTop: 10 }}><button className="btn sm" type="button" disabled={pending} onClick={() => run(() => decideGrant(id, 'revoke'))}>Revoke</button></div>;
}
