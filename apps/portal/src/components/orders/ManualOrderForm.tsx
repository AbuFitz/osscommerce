'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@oss-commerce/ui';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { createManualOrderAction } from '@/app/actions';
import { money } from '@/lib/format';
import type { Customer, ManualOrderInput, OrderableItem, ShippingChoice } from '@/lib/gateway';

const PAY: { k: ManualOrderInput['payment']; l: string }[] = [{ k: 'card_in_person', l: 'Card, in person' }, { k: 'cash', l: 'Cash' }, { k: 'bank_transfer', l: 'Bank transfer' }, { k: 'other', l: 'Another way' }];

/** Take an order yourself: choose the customer and items, say how they are getting it and how they paid. It is created, paid and placed in one step. */
export function ManualOrderForm({ items, shipping, customers }: { items: OrderableItem[]; shipping: ShippingChoice[]; customers: Customer[] }) {
  const toast = useToast(); const router = useRouter(); const [pending, start] = useTransition(); const [tried, setTried] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>(customers.length ? 'existing' : 'new'); const [cq, setCq] = useState(''); const [cid, setCid] = useState('');
  const [n, setN] = useState({ email: '', first: '', last: '', phone: '' }); const [q, setQ] = useState(''); const [lines, setLines] = useState<Record<string, number>>({});
  const [ship, setShip] = useState(shipping.find(s => /collect/i.test(s.name))?.id ?? ''); const [a, setA] = useState({ name: '', line1: '', line2: '', city: '', postcode: '' }); const [coupon, setCoupon] = useState(''); const [note, setNote] = useState(''); const [pay, setPay] = useState<ManualOrderInput['payment']>('card_in_person');
  const byId = useMemo(() => new Map(items.map(i => [i.variantId, i])), [items]); const chosen = Object.entries(lines).filter(([, q]) => q > 0).map(([id, qty]) => ({ i: byId.get(id)!, qty })).filter(l => l.i);
  const sub = chosen.reduce((s, l) => s + l.i.priceMinor * l.qty, 0); const cust = customers.find(c => c.id === cid);
  const found = items.filter(i => `${i.title} ${i.variant ?? ''} ${i.sku}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8); const cfound = customers.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(cq.trim().toLowerCase())).slice(0, 6);
  const set = (id: string, qty: number) => setLines(l => ({ ...l, [id]: Math.max(0, Math.min(qty, byId.get(id)?.available ?? 0)) }));
  const err: Record<string, string> = {};
  if (mode === 'existing' && !cid) err.customer = 'Choose a customer, or add a new one.'; if (mode === 'new' && !/^\S+@\S+\.\S+$/.test(n.email)) err.email = 'Enter a valid email address.'; if (mode === 'new' && !n.first.trim()) err.first = 'Enter a first name.';
  if (!chosen.length) err.items = 'Add at least one item.'; if (!ship) err.ship = 'Choose a delivery option. For a sale in person, choose Collection.';
  if (ship && (!a.name.trim() || !a.line1.trim() || !a.city.trim() || !a.postcode.trim())) err.address = 'Enter the delivery address. For collection, use the customer’s own.';
  const show = (k: string) => (tried ? err[k] : undefined);
  const submit = () => { setTried(true); if (Object.keys(err).length) { toast(Object.values(err)[0], 'error'); return; }
    const input: ManualOrderInput = { customer: mode === 'existing' ? { id: cid } : { email: n.email.trim(), firstName: n.first.trim(), lastName: n.last.trim(), phone: n.phone.trim() || undefined }, items: chosen.map(l => ({ variantId: l.i.variantId, qty: l.qty })), shippingMethodId: ship, address: { fullName: a.name.trim(), line1: a.line1.trim(), line2: a.line2.trim() || undefined, city: a.city.trim(), postcode: a.postcode.trim() }, coupon: coupon.trim() || undefined, note: note.trim() || undefined, payment: pay };
    start(async () => { const r = await createManualOrderAction(input); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok && r.id) router.push(`/orders/${r.id}`); }); };

  return (<form className="pf" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
    <div className="pf-main">
      <section className="w fd" aria-labelledby="mo1"><h2 id="mo1">Customer</h2>
        <div className="seg-field" role="radiogroup" aria-label="Customer">{([['existing', 'Existing customer'], ['new', 'New customer']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} data-on={mode === k || undefined} onClick={() => setMode(k)}>{l}</button>)}</div>
        {mode === 'existing' ? (<div className={`field${show('customer') ? ' bad' : ''}`}>
          {cust ? <div className="mo-picked"><span><b>{cust.name}</b><span className="muted"> {cust.email}</span></span><button type="button" className="iconbtn" onClick={() => setCid('')} aria-label="Choose a different customer"><X size={15} aria-hidden /></button></div>
            : (<><div className="dsearch"><Search size={15} aria-hidden /><input aria-label="Search customers" placeholder="Search by name or email" value={cq} onChange={e => setCq(e.target.value)} /></div>
              <ul className="mo-list" role="listbox" aria-label="Customers">{cfound.map(c => <li key={c.id}><button type="button" role="option" aria-selected={false} onClick={() => { setCid(c.id); setA(x => ({ ...x, name: x.name || c.name })); }}><b>{c.name}</b><span className="muted">{c.email}</span></button></li>)}{cfound.length === 0 && <li className="muted" style={{ padding: 8 }}>No customers match. Add a new one instead.</li>}</ul></>)}
          {show('customer') && <p className="ferr" role="alert">{err.customer}</p>}</div>)
          : (<><div className="drow"><div className={`field${show('first') ? ' bad' : ''}`}><label htmlFor="mf">First name</label><input id="mf" value={n.first} onChange={e => { setN({ ...n, first: e.target.value }); setA(x => ({ ...x, name: `${e.target.value} ${n.last}`.trim() })); }} />{show('first') && <p className="ferr">{err.first}</p>}</div><div className="field"><label htmlFor="ml">Last name</label><input id="ml" value={n.last} onChange={e => { setN({ ...n, last: e.target.value }); setA(x => ({ ...x, name: `${n.first} ${e.target.value}`.trim() })); }} /></div></div>
            <div className="drow"><div className={`field${show('email') ? ' bad' : ''}`}><label htmlFor="me">Email</label><input id="me" type="email" value={n.email} onChange={e => setN({ ...n, email: e.target.value })} />{show('email') && <p className="ferr">{err.email}</p>}</div><div className="field"><label htmlFor="mp">Phone <span className="muted">(optional)</span></label><input id="mp" inputMode="tel" value={n.phone} onChange={e => setN({ ...n, phone: e.target.value })} /></div></div></>)}
      </section>
      <section className="w fd" aria-labelledby="mo2"><h2 id="mo2">Items</h2>
        <div className="dsearch"><Search size={15} aria-hidden /><input aria-label="Search products" placeholder="Search products to add" value={q} onChange={e => setQ(e.target.value)} /></div>
        {q.trim() && <ul className="mo-list" role="listbox" aria-label="Products">{found.map(i => <li key={i.variantId}><button type="button" role="option" aria-selected={false} disabled={i.available === 0} onClick={() => { set(i.variantId, (lines[i.variantId] ?? 0) + 1); setQ(''); }}><span><b>{i.title}</b>{i.variant && <span className="muted"> {i.variant}</span>}</span><span className="muted">{i.available === 0 ? 'Out of stock' : `${money(i.priceMinor)} · ${i.available} in stock`}</span></button></li>)}{found.length === 0 && <li className="muted" style={{ padding: 8 }}>Nothing matches.</li>}</ul>}
        {chosen.length === 0 ? <p className={`muted${show('items') ? ' ferr' : ''}`} style={{ margin: 0 }}>{show('items') ?? 'Search above to add items.'}</p> : <ul className="mo-lines">{chosen.map(l => <li key={l.i.variantId}><span className="t"><b>{l.i.title}</b><span className="muted">{l.i.variant ? `${l.i.variant} · ` : ''}{money(l.i.priceMinor)} each · {l.i.available} in stock</span></span>
          <div className="stepper" role="group" aria-label={`Quantity of ${l.i.title}`}><button type="button" onClick={() => set(l.i.variantId, l.qty - 1)} aria-label="One fewer"><Minus size={14} aria-hidden /></button><output aria-live="polite">{l.qty}</output><button type="button" onClick={() => set(l.i.variantId, l.qty + 1)} disabled={l.qty >= l.i.available} aria-label="One more"><Plus size={14} aria-hidden /></button></div>
          <span className="num">{money(l.i.priceMinor * l.qty)}</span><button type="button" className="iconbtn" onClick={() => set(l.i.variantId, 0)} aria-label={`Remove ${l.i.title}`}><Trash2 size={15} aria-hidden /></button></li>)}</ul>}
      </section>
      <section className="w fd" aria-labelledby="mo3"><h2 id="mo3">Delivery</h2>
        <div className={`field${show('ship') ? ' bad' : ''}`}><label htmlFor="msh">Delivery option</label><select id="msh" value={ship} onChange={e => setShip(e.target.value)}><option value="">Choose…</option>{shipping.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{show('ship') && <p className="ferr">{err.ship}</p>}</div>
        <div className={`field${show('address') ? ' bad' : ''}`}><label htmlFor="an">Address</label><input id="an" placeholder="Full name" value={a.name} onChange={e => setA({ ...a, name: e.target.value })} /><input aria-label="Address line 1" placeholder="Address line 1" value={a.line1} onChange={e => setA({ ...a, line1: e.target.value })} /><input aria-label="Address line 2" placeholder="Address line 2 (optional)" value={a.line2} onChange={e => setA({ ...a, line2: e.target.value })} />
          <div className="drow"><input aria-label="Town or city" placeholder="Town or city" value={a.city} onChange={e => setA({ ...a, city: e.target.value })} /><input aria-label="Postcode" placeholder="Postcode" value={a.postcode} onChange={e => setA({ ...a, postcode: e.target.value.toUpperCase() })} /></div>{show('address') && <p className="ferr">{err.address}</p>}</div>
      </section>
      <section className="w fd" aria-labelledby="mo4"><h2 id="mo4">Extras</h2>
        <div className="field"><label htmlFor="mc">Discount code <span className="muted">(optional)</span></label><input id="mc" value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())} /></div>
        <div className="field"><label htmlFor="mn">Private note <span className="muted">(optional)</span></label><textarea id="mn" rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Only your team can see this" /></div>
      </section>
    </div>
    <aside className="pf-side mo-side"><section className="w fd pf-sticky" aria-labelledby="mo5"><h2 id="mo5">Payment</h2>
      <fieldset className="dseg"><legend className="sr">How it was paid</legend><div role="radiogroup" aria-label="How it was paid" style={{ gridTemplateColumns: '1fr' }}>{PAY.map(p => <button key={p.k} type="button" role="radio" aria-checked={pay === p.k} onClick={() => setPay(p.k)}><b>{p.l}</b></button>)}</div></fieldset>
      <dl className="kv"><dt>Items</dt><dd className="num">{money(sub)}</dd><dt>Delivery and discounts</dt><dd className="muted">Worked out when placed</dd></dl>
      <p className="muted pf-note">The order is placed and marked as paid straight away, and the stock is reserved. This payment is recorded, not taken, so it does not go through Stripe or carry our fee.</p>
      <button className="btn primary" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Placing…' : 'Place order and mark as paid'}</button></section></aside>
  </form>);
}
