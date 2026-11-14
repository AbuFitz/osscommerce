'use client';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { useToast } from './Toast';
import { money } from '@/lib/format';

/** Demo mode: dialogs show the real decision and consequence, but nothing is sent. Replace `confirm` with a gateway call. */
const DEMO = 'Demo data: nothing was changed.';

function useDialog() { const [open, setOpen] = useState(false); return { open, show: () => setOpen(true), hide: () => setOpen(false) }; }

export function FulfilAction({ number, items }: { number: number; items: string[] }) {
  const d = useDialog(); const toast = useToast();
  return (<>
    <button className="btn lime" type="button" onClick={d.show}>Mark as fulfilled</button>
    <Dialog open={d.open} onClose={d.hide} title={`Fulfil order #${number}`} description="The customer is emailed a shipping confirmation with the tracking link."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" onClick={() => { d.hide(); toast(`Order #${number} marked fulfilled. ${DEMO}`, 'info'); }}>Mark as fulfilled</button></>}>
      <ul className="dlg-list">{items.map(i => <li key={i}>{i}</li>)}</ul>
      <div className="field"><label htmlFor="trk">Tracking number <span className="muted">(optional)</span></label><input id="trk" inputMode="text" autoComplete="off" /></div>
    </Dialog>
  </>);
}

export function RefundAction({ number, totalMinor, refundedMinor, feeBp }: { number: number; totalMinor: number; refundedMinor: number; feeBp: number }) {
  const d = useDialog(); const toast = useToast();
  const left = totalMinor - refundedMinor;
  const [full, setFull] = useState(true); const [amt, setAmt] = useState(''); const [restock, setRestock] = useState(true); const [fee, setFee] = useState(false);
  const minor = full ? left : Math.round(parseFloat(amt || '0') * 100);
  const bad = !Number.isFinite(minor) || minor <= 0 || minor > left;
  return (<>
    <button className="btn ghost" type="button" onClick={d.show}>Refund</button>
    <Dialog open={d.open} onClose={d.hide} title={`Refund order #${number}`} description={`${money(left)} can still be refunded. This goes back to the customer's card.`}
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={bad} onClick={() => { d.hide(); toast(`Refund of ${money(minor)} for #${number}. ${DEMO}`, 'info'); }}>Refund {bad ? '' : money(minor)}</button></>}>
      <fieldset className="radios"><legend className="sr">Refund amount</legend>
        <label><input type="radio" name="amt" checked={full} onChange={() => setFull(true)} /> Full remaining amount ({money(left)})</label>
        <label><input type="radio" name="amt" checked={!full} onChange={() => setFull(false)} /> Part refund</label></fieldset>
      {!full && <div className="field"><label htmlFor="ra">Amount (£)</label><input id="ra" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={bad} aria-describedby="ra-h" /><small id="ra-h" className={bad ? 'err' : 'muted'}>{bad ? `Enter an amount up to ${money(left)}.` : 'Tax and shipping are allocated automatically.'}</small></div>}
      <div className="field"><label htmlFor="rr">Reason</label><select id="rr"><option>Customer request</option><option>Item damaged</option><option>Out of stock</option><option>Other</option></select></div>
      <label className="check1"><input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} /> Return items to stock</label>
      <label className="check1"><input type="checkbox" checked={fee} onChange={e => setFee(e.target.checked)} /> Also refund our {(feeBp / 100).toFixed(2)}% platform fee</label>
      <p className="note">Stripe may keep its own processing fee. We show Pending until Stripe confirms the refund, so confirm once.</p>
    </Dialog>
  </>);
}

export function InviteAction() {
  const d = useDialog(); const toast = useToast(); const [email, setEmail] = useState(''); const ok = /^\S+@\S+\.\S+$/.test(email);
  return (<>
    <button className="btn primary" type="button" onClick={d.show}>Invite member</button>
    <Dialog open={d.open} onClose={d.hide} title="Invite a team member" description="They get an email invitation. You choose exactly what they can do."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" disabled={!ok} onClick={() => { d.hide(); toast(`Invitation to ${email}. ${DEMO}`, 'info'); }}>Send invitation</button></>}>
      <div className="field"><label htmlFor="ie">Email</label><input id="ie" type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="ir">Role</label><select id="ir" defaultValue="fulfilment"><option value="manager">Manager: products, orders, discounts</option><option value="fulfilment">Fulfilment: orders and shipping</option><option value="analyst">Analyst: reports only</option></select></div>
    </Dialog>
  </>);
}

export function RollbackAction({ version }: { version: string }) {
  const d = useDialog(); const toast = useToast();
  return (<>
    <button className="btn sm" type="button" onClick={d.show}>Roll back</button>
    <Dialog open={d.open} onClose={d.hide} title={`Roll back to v${version}?`} description="Your live storefront switches to this version within about a minute. Orders and products are not affected."
      footer={<><button className="btn" type="button" onClick={d.hide}>Cancel</button><button className="btn primary" type="button" onClick={() => { d.hide(); toast(`Rollback to v${version} requested. ${DEMO}`, 'info'); }}>Roll back</button></>}><span /></Dialog>
  </>);
}

export function GrantAction({ who, state }: { who: string; state: 'pending' | 'active' }) {
  const toast = useToast();
  return state === 'pending' ? (
    <div className="acts" style={{ marginTop: 10 }}>
      <button className="btn sm primary" type="button" onClick={() => toast(`Access for ${who} approved for the time shown. ${DEMO}`, 'info')}>Approve</button>
      <button className="btn sm" type="button" onClick={() => toast(`Request from ${who} declined. ${DEMO}`, 'info')}>Decline</button></div>
  ) : <div style={{ marginTop: 10 }}><button className="btn sm" type="button" onClick={() => toast(`Access for ${who} revoked. ${DEMO}`, 'info')}>Revoke</button></div>;
}
