'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { money } from '@/lib/format';
import type { MutationResult, Member } from '@/lib/gateway';
import { decideGrant, fulfilOrder, inviteMember, refundOrder, rollbackTheme } from '@/app/actions';

/** Runs a server action, then tells the person the real outcome. Failures say nothing changed. */
export function useRun() {
  const toast = useToast(); const [pending, start] = useTransition();
  const run = (fn: () => Promise<MutationResult>, done?: () => void) => start(async () => {
    const r = await fn(); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) done?.();
  });
  return { run, pending };
}
function useDialog() { const [open, setOpen] = useState(false); return { open, show: () => setOpen(true), hide: () => setOpen(false) }; }

export function FulfilAction({ orderId, number, items }: { orderId: string; number: number; items: string[] }) {
  const d = useDialog(); const { run, pending } = useRun(); const [trk, setTrk] = useState('');
  return (<>
    <button className="btn lime" type="button" onClick={d.show}>Mark as fulfilled</button>
    <Dialog open={d.open} onClose={d.hide} title={`Fulfil order #${number}`} description="The customer is emailed a shipping confirmation with the tracking link."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => fulfilOrder(orderId, trk || undefined), d.hide)}>{pending ? 'Saving…' : 'Mark as fulfilled'}</button></>}>
      <ul className="dlg-list">{items.map(i => <li key={i}>{i}</li>)}</ul>
      <div className="field"><label htmlFor="trk">Tracking number <span className="muted">(optional)</span></label><input id="trk" autoComplete="off" value={trk} onChange={e => setTrk(e.target.value)} /></div>
    </Dialog>
  </>);
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
  const d = useDialog(); const { run, pending } = useRun(); const [email, setEmail] = useState(''); const [role, setRole] = useState<Member['role']>('fulfilment');
  const ok = /^\S+@\S+\.\S+$/.test(email);
  return (<>
    <button className="btn primary" type="button" onClick={d.show}>Invite member</button>
    <Dialog open={d.open} onClose={d.hide} title="Invite a team member" description="They get an email invitation. You choose exactly what they can do."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={!ok || pending} onClick={() => run(() => inviteMember(email, role), () => { setEmail(''); d.hide(); })}>{pending ? 'Sending…' : 'Send invitation'}</button></>}>
      <div className="field"><label htmlFor="ie">Email</label><input id="ie" type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="ir">Role</label><select id="ir" value={role} onChange={e => setRole(e.target.value as Member['role'])}><option value="manager">Manager: products, orders, discounts</option><option value="fulfilment">Fulfilment: orders and shipping</option><option value="analyst">Analyst: reports only</option></select></div>
    </Dialog>
  </>);
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
