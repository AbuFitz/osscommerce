'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Dialog } from '@oss-commerce/ui';
import { ArrowDown, ArrowUp, Minus, Plus, Search } from 'lucide-react';
import { money } from '@/lib/format';
import { applyOrderEdit, orderableItemsAction, previewOrderEdit, refundOrder } from '@/app/actions';
import type { ManualOrderInput, Order, OrderEditPreview, OrderableItem } from '@/lib/gateway';
import { useRun } from '../Actions';

const PAY = [['cash', 'Cash'], ['card_in_person', 'Card, in person'], ['bank_transfer', 'Bank transfer'], ['other', 'Another way']] as const;
const pounds = (s: string) => { const n = Math.round(parseFloat(s.replace(/[£,\s]/g, '')) * 100); return Number.isFinite(n) ? n : NaN; };
const label = (l: { title: string; variant?: string }) => l.variant ? `${l.title} (${l.variant})` : l.title;

function Stepper({ value, min, max, onChange, name }: { value: number; min: number; max: number; onChange: (n: number) => void; name: string }) {
  return (<div className="stepper" role="group" aria-label={name}><button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="One fewer"><Minus size={15} aria-hidden /></button><output>{value}</output><button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more"><Plus size={15} aria-hidden /></button></div>);
}

/** Change an order after it was placed: quantities, extra items, a charge or discount, the delivery address. Two steps: make the change, then see exactly what it does to the total before anything is saved. */
export function EditOrderAction({ order }: { order: Order }) {
  const [open, setOpen] = useState(false); const [step, setStep] = useState<'edit' | 'review'>('edit'); const { run, pending } = useRun(); const [checking, startCheck] = useTransition();
  const lines = order.lines.filter(l => l.id);
  const start = () => Object.fromEntries(lines.map(l => [l.id!, l.qty]));
  const [qty, setQty] = useState<Record<string, number>>(start); const [add, setAdd] = useState<Record<string, number>>({}); const [q, setQ] = useState(''); const [items, setItems] = useState<OrderableItem[] | null>(null);
  const [sLabel, setSLabel] = useState(''); const [sAmt, setSAmt] = useState(''); const [sign, setSign] = useState<1 | -1>(1); const [addrOn, setAddrOn] = useState(false); const [addr, setAddr] = useState({ fullName: order.customer, line1: '', line2: '', city: '', postcode: '' });
  const [note, setNote] = useState(''); const [pay, setPay] = useState<ManualOrderInput['payment'] | ''>(''); const [why, setWhy] = useState('Order changed'); const [prev, setPrev] = useState<OrderEditPreview | null>(null); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setStep('edit'); setQty(start()); setAdd({}); setQ(''); setSLabel(''); setSAmt(''); setSign(1); setAddrOn(false); setNote(''); setPay(''); setPrev(null); setErr(''); if (!items) orderableItemsAction().then(setItems).catch(() => setItems([])); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useMemo(() => { const t = q.trim().toLowerCase(); if (!t || !items) return []; return items.filter(i => `${i.title} ${i.variant ?? ''} ${i.sku}`.toLowerCase().includes(t) && !(i.variantId in add)).slice(0, 6); }, [q, items, add]);
  const surMinor = sAmt.trim() ? pounds(sAmt) * sign : 0; const surBad = sAmt.trim() !== '' && (!Number.isFinite(surMinor) || surMinor === 0);
  const addrBad = addrOn && (!addr.fullName.trim() || !addr.line1.trim() || !addr.city.trim() || !addr.postcode.trim());
  const input = () => ({ orderId: order.id, lines: lines.map(l => ({ lineId: l.id!, qty: qty[l.id!] ?? l.qty })), add: Object.entries(add).map(([variantId, n]) => ({ variantId, qty: n })), surcharge: surMinor ? { label: sLabel.trim() || (surMinor > 0 ? 'Extra charge' : 'Discount'), amountMinor: surMinor } : undefined, address: addrOn ? { fullName: addr.fullName.trim(), line1: addr.line1.trim(), line2: addr.line2.trim() || undefined, city: addr.city.trim(), postcode: addr.postcode.trim() } : undefined, note: note.trim() || undefined });
  const changed = lines.some(l => (qty[l.id!] ?? l.qty) !== l.qty) || Object.keys(add).length > 0 || !!surMinor || addrOn;
  const review = () => { setErr(''); startCheck(async () => { const p = await previewOrderEdit(input()); if (!p.ok) { setErr(p.message); return; } setPrev(p); setStep('review'); }); };
  const up = (prev?.changeMinor ?? 0) > 0; const down = (prev?.changeMinor ?? 0) < 0;
  const confirm = () => run(() => applyOrderEdit({ ...input(), payment: up ? (pay || undefined) : undefined, reason: down ? why : undefined }), () => setOpen(false));
  return (<>
    <button className="btn ghost" type="button" onClick={() => setOpen(true)}>Edit order</button>
    <Dialog open={open} onClose={() => setOpen(false)} title={`Edit order #${order.number}`} description={step === 'edit' ? 'Change what is on the order. Nothing is saved until you have reviewed the new total.' : 'Check this before you confirm. The customer is not emailed automatically.'}
      footer={step === 'edit' ? <><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" type="button" disabled={!changed || surBad || addrBad || checking} aria-busy={checking} onClick={review}>{checking ? 'Checking…' : 'Review change'}</button></>
        : <><button className="btn" type="button" onClick={() => setStep('edit')} disabled={pending}>Back</button><button className="btn primary" type="button" disabled={pending || (up && !pay)} aria-busy={pending} onClick={confirm}>{pending ? 'Saving…' : up ? `Confirm and record ${money(prev!.changeMinor)} paid` : down ? `Confirm and refund ${money(-prev!.changeMinor)}` : 'Confirm change'}</button></>}>
      {step === 'edit' ? (<div className="oe">
        <ul className="fq" aria-label="Items on the order">{lines.map(l => { const sent = l.sent ?? 0; const n = qty[l.id!] ?? l.qty; return (
          <li key={l.id} data-gone={n === 0 || undefined}><span className="t"><b>{label(l)}</b><span className="muted">{money(l.unitMinor)} each{sent > 0 ? ` · ${sent} already sent` : ''}{n === 0 ? ' · will be removed' : ''}</span></span><Stepper name={`Quantity of ${label(l)}`} value={n} min={sent} max={999} onChange={v => setQty(s => ({ ...s, [l.id!]: v }))} /></li>); })}
          {Object.entries(add).map(([vid, n]) => { const it = items?.find(i => i.variantId === vid); if (!it) return null; return (<li key={vid} className="new"><span className="t"><b>{label(it)}</b><span className="muted">{money(it.priceMinor)} each · new item · {it.available} available</span></span><Stepper name={`Quantity of ${label(it)}`} value={n} min={0} max={Math.min(it.available, 999)} onChange={v => setAdd(s => { const c = { ...s }; if (v === 0) delete c[vid]; else c[vid] = v; return c; })} /></li>); })}</ul>
        <div className="field"><label htmlFor="oe-q">Add an item</label><div className="mo-find"><Search size={16} aria-hidden /><input id="oe-q" type="search" placeholder="Search products by name or SKU" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" /></div>
          {found.length > 0 && <ul className="mo-list" role="listbox" aria-label="Products" data-fade>{found.map(i => <li key={i.variantId}><button type="button" role="option" aria-selected={false} onClick={() => { setAdd(s => ({ ...s, [i.variantId]: 1 })); setQ(''); }}><span><b>{i.title}</b>{i.variant && <span className="muted"> {i.variant}</span>}</span><span className="muted">{money(i.priceMinor)} · {i.available} left</span></button></li>)}</ul>}</div>
        <fieldset className="fd-g"><legend>Add a charge or a discount <span className="muted">(optional)</span></legend>
          <div className="seg-field" role="radiogroup" aria-label="Charge or discount"><button type="button" role="radio" aria-checked={sign === 1} data-on={sign === 1} onClick={() => setSign(1)}><ArrowUp size={14} aria-hidden /> Charge</button><button type="button" role="radio" aria-checked={sign === -1} data-on={sign === -1} onClick={() => setSign(-1)}><ArrowDown size={14} aria-hidden /> Discount</button></div>
          <div className="pf-row"><div className="field"><label htmlFor="oe-sl">What is it for</label><input id="oe-sl" maxLength={80} placeholder={sign === 1 ? 'Gift wrapping' : 'Goodwill'} value={sLabel} onChange={e => setSLabel(e.target.value)} /></div>
            <div className="field"><label htmlFor="oe-sa">Amount (£)</label><input id="oe-sa" inputMode="decimal" placeholder="0.00" value={sAmt} onChange={e => setSAmt(e.target.value)} aria-invalid={surBad} /></div></div></fieldset>
        <label className="check1"><input type="checkbox" checked={addrOn} onChange={e => setAddrOn(e.target.checked)} /> Change the delivery address</label>
        {addrOn && <div className="fd-g"><div className="field"><label htmlFor="oe-n">Full name</label><input id="oe-n" value={addr.fullName} onChange={e => setAddr(a => ({ ...a, fullName: e.target.value }))} /></div><div className="field"><label htmlFor="oe-1">Address line 1</label><input id="oe-1" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))} /></div><div className="field"><label htmlFor="oe-2">Address line 2 <span className="muted">(optional)</span></label><input id="oe-2" value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))} /></div><div className="pf-row"><div className="field"><label htmlFor="oe-c">Town or city</label><input id="oe-c" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} /></div><div className="field"><label htmlFor="oe-p">Postcode</label><input id="oe-p" value={addr.postcode} onChange={e => setAddr(a => ({ ...a, postcode: e.target.value }))} /></div></div></div>}
        <div className="field"><label htmlFor="oe-note">Private note <span className="muted">(optional)</span></label><input id="oe-note" maxLength={200} placeholder="Why the order changed" value={note} onChange={e => setNote(e.target.value)} /></div>
        {err && <p className="ferr" role="alert">{err}</p>}
      </div>) : prev && (<div className="oe">
        <div className={`oe-sum ${up ? 'up' : down ? 'down' : ''}`}><span className="muted">New total</span><b>{money(prev.newTotalMinor)}</b><span className="oe-d">{up ? `${money(prev.changeMinor)} more than before` : down ? `${money(-prev.changeMinor)} less than before` : 'The same as before'}</span></div>
        <ul className="fq" aria-label="Order after the change">{prev.lines.map((l, i) => <li key={i}><span className="t"><b>{label(l)}</b><span className="muted">{l.qty} × {money(l.unitMinor)}</span></span><b className="num">{money(l.lineMinor)}</b></li>)}</ul>
        {up && <fieldset className="fd-g"><legend>How was the extra {money(prev.changeMinor)} paid?</legend><div className="seg-field wrap" role="radiogroup" aria-label="Payment method">{PAY.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={pay === k} data-on={pay === k} onClick={() => setPay(k)}>{l}</button>)}</div><p className="note">This records a payment you took yourself. It does not charge the customer's card.</p></fieldset>}
        {down && <div className="field"><label htmlFor="oe-why">Reason for the refund</label><select id="oe-why" value={why} onChange={e => setWhy(e.target.value)}><option>Order changed</option><option>Item removed at customer's request</option><option>Out of stock</option><option>Goodwill</option></select><p className="note">{money(-prev.changeMinor)} goes back to the customer's original payment method. Our fee on it is returned to you.</p></div>}
      </div>)}
    </Dialog>
  </>);
}

/** Money back, with or without goods coming back. Choose the items returned and the refund fills in; tick "put back in stock" and the shelf count really goes up. */
export function ReturnAction({ order, feeNote }: { order: Order; feeNote?: string }) {
  const [open, setOpen] = useState(false); const { run, pending } = useRun(); const lines = order.lines.filter(l => l.id);
  const [mode, setMode] = useState<'items' | 'amount'>(lines.length ? 'items' : 'amount'); const [rq, setRq] = useState<Record<string, number>>({}); const [amt, setAmt] = useState(''); const [restock, setRestock] = useState(true); const [reason, setReason] = useState('Customer return');
  const left = order.totalMinor - order.refundedMinor;
  useEffect(() => { if (open) { setRq({}); setAmt(''); setRestock(true); setReason('Customer return'); setMode(lines.length ? 'items' : 'amount'); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = lines.filter(l => (rq[l.id!] ?? 0) > 0); const itemsMinor = picked.reduce((s, l) => s + (rq[l.id!] ?? 0) * l.unitMinor, 0);
  const typed = amt.trim() ? pounds(amt) : NaN; const minor = mode === 'items' ? (amt.trim() ? typed : Math.min(itemsMinor, left)) : typed;
  const bad = !Number.isFinite(minor) || minor <= 0 || minor > left || (mode === 'items' && picked.length === 0);
  return (<>
    <button className="btn ghost" type="button" onClick={() => setOpen(true)}>Refund or return</button>
    <Dialog open={open} onClose={() => setOpen(false)} title={`Refund or return, order #${order.number}`} description={`${money(left)} can still be refunded. It goes back to the customer's original payment method.`}
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" type="button" disabled={bad || pending} aria-busy={pending} onClick={() => run(() => refundOrder({ orderId: order.id, amountMinor: minor, reason, restock: mode === 'items' && restock, lines: mode === 'items' ? picked.map(l => ({ lineId: l.id!, qty: rq[l.id!] })) : undefined }), () => setOpen(false))}>{pending ? 'Sending…' : `Refund ${bad ? '' : money(minor)}`}</button></>}>
      <div className="oe">
        <div className="seg-field" role="radiogroup" aria-label="What are you refunding">{lines.length > 0 && <button type="button" role="radio" aria-checked={mode === 'items'} data-on={mode === 'items'} onClick={() => setMode('items')}>Items returned</button>}<button type="button" role="radio" aria-checked={mode === 'amount'} data-on={mode === 'amount'} onClick={() => setMode('amount')}>An amount</button></div>
        {mode === 'items' && <ul className="fq" aria-label="Items returned">{lines.map(l => (<li key={l.id}><span className="t"><b>{label(l)}</b><span className="muted">{money(l.unitMinor)} each · {l.qty} on the order</span></span><Stepper name={`Quantity of ${label(l)} returned`} value={rq[l.id!] ?? 0} min={0} max={l.qty} onChange={v => setRq(s => ({ ...s, [l.id!]: v }))} /></li>))}</ul>}
        <div className="field"><label htmlFor="rf-a">{mode === 'items' ? 'Refund amount (£)' : 'Amount (£)'}</label><input id="rf-a" inputMode="decimal" placeholder={mode === 'items' && itemsMinor ? (Math.min(itemsMinor, left) / 100).toFixed(2) : '0.00'} value={amt} onChange={e => setAmt(e.target.value)} aria-invalid={amt.trim() !== '' && bad} />
          <small className={bad && amt.trim() ? 'ferr' : 'fhint muted'}>{mode === 'items' ? (picked.length ? `Worked out from the items: ${money(Math.min(itemsMinor, left))}. Change it to include delivery or take off a restocking charge.` : 'Choose the items that came back.') : `Up to ${money(left)}.`}</small></div>
        <div className="field"><label htmlFor="rf-r">Reason</label><select id="rf-r" value={reason} onChange={e => setReason(e.target.value)}><option>Customer return</option><option>Item damaged</option><option>Wrong item sent</option><option>Out of stock</option><option>Goodwill</option><option>Other</option></select></div>
        {mode === 'items' && <label className="check1"><input type="checkbox" checked={restock} onChange={e => setRestock(e.target.checked)} /> Put returned items back in stock <span className="muted">(adds them to the shelf count, logged as a customer return)</span></label>}
        <p className="note">{feeNote ?? 'Our fee on the refunded part is returned to you automatically. Stripe keeps its own processing fee.'} A refund can show as Pending until Stripe confirms it, so confirm once.</p>
      </div>
    </Dialog>
  </>);
}
