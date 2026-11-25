import { Brand } from '@/components/Brand';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when } from '@/lib/format';
import { PayBadge, FulBadge, Avatar } from '@/components/ui';
import { Media } from '@/components/art';
import { CancelAction, FulfilAction, NoteForm } from '@/components/Actions';
import { EditOrderAction, FinishEditAction, ReturnAction } from '@/components/orders/OrderEdit';
import { Printer } from 'lucide-react';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const o = await gateway().order((await params).id);
  if (!o) notFound();
  const sub = o.lines.reduce((s, l) => s + l.qty * l.unitMinor, 0);
  const canFulfil = o.state === 'open' && o.payment === 'paid';
  const placed = true, paid = o.payment !== 'failed' && o.payment !== 'pending', shipped = o.fulfilment === 'fulfilled';
  return (
    <>
      <Link className="link" href="/orders" style={{ marginBottom: 14 }}><ChevronLeft size={15} aria-hidden />Orders</Link>
      <section className="w dark" style={{ marginBottom: 16 }} aria-labelledby="oh">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><div className="muted">{when(o.placedAt)}</div><h1 id="oh" style={{ margin: '4px 0 12px' }}>Order #{o.number}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><PayBadge s={o.payment} /><FulBadge s={o.fulfilment} state={o.state} /></div></div>
          <div style={{ textAlign: 'right' }}><div className="muted">Total</div><div className="big">{money(o.totalMinor)}</div></div>
        </div>
        <div className="steps" aria-label="Progress">
          <div className={placed ? 'on' : ''}>Placed</div><div className={paid ? 'on' : ''}>{o.payment === 'failed' ? 'Payment failed' : 'Paid'}</div><div className={shipped ? 'on' : ''}>Fulfilled</div>
        </div>
        <div className="acts" style={{ marginTop: 18 }}>
          {canFulfil && <FulfilAction orderId={o.id} number={o.number} lines={o.lines} />}
          {o.state === 'open' && o.fulfilment === 'unfulfilled' && <CancelAction orderId={o.id} number={o.number} paid={o.payment === 'paid'} />}
          {o.state === 'open' && (o.payment === 'paid' || o.payment === 'partially_refunded') && <EditOrderAction order={o} />}
          {(o.payment === 'paid' || o.payment === 'partially_refunded') && <ReturnAction order={o} />}
        <Link className="btn ghost" href={`/slip/${o.id}`} target="_blank"><Printer size={15} aria-hidden />Packing slip</Link>
        </div>
      </section>
      {o.editing && <div style={{ marginBottom: 16 }}><FinishEditAction order={o} /></div>}
      {o.payment === 'failed' && <div className="w flat" style={{ marginBottom: 16 }}>Payment failed. No charge was made and nothing needs fulfilling.</div>}
      <div className="grid">
        <section className="w c-8" aria-labelledby="items">
          <h2 id="items" style={{ marginBottom: 12 }}>Items</h2>
          <div className="rows">{o.lines.map(l => (
            <div key={l.sku} className="row"><Media src={l.imageUrl} alt="" size={44} /><span className="t"><b>{l.title}</b><span className="mono">{l.sku} · {l.qty} × {money(l.unitMinor)}{(l.sent ?? 0) > 0 ? ` · ${l.sent} of ${l.qty} sent` : ''}</span></span><span className="num">{money(l.qty * l.unitMinor)}</span></div>))}</div>
          <dl className="kv" style={{ marginTop: 18 }}>
            <dt>Subtotal</dt><dd className="num">{money(sub)}</dd>
            {o.discountMinor > 0 && <><dt>Discount</dt><dd className="num">−{money(o.discountMinor)}</dd></>}
            <dt>Shipping</dt><dd className="num">{o.shippingMinor ? money(o.shippingMinor) : 'Free'}</dd>
            <dt>VAT included</dt><dd className="num">{money(o.taxMinor)}</dd>
            <dt style={{ color: 'var(--ink)', fontWeight: 600 }}>Total</dt><dd className="num" style={{ fontWeight: 600 }}>{money(o.totalMinor)}</dd>
            {o.refundedMinor > 0 && <><dt>Refunded</dt><dd className="num">−{money(o.refundedMinor)}</dd></>}
          </dl>
        </section>
        <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="w" aria-labelledby="pay"><h2 id="pay" style={{ marginBottom: 12 }}>Payment</h2>
            <div className="row"><Brand name={o.method?.wallet ?? o.method?.brand ?? 'stripe'} label={o.method ? undefined : 'Stripe'} size={44} title /><span className="t"><b>{o.method ? `${({ visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' } as Record<string, string>)[o.method.brand]} ···· ${o.method.last4}` : 'Not recorded'}</b><span>{o.method?.wallet ? `Paid with ${({ applepay: 'Apple Pay', googlepay: 'Google Pay', link: 'Link' } as Record<string, string>)[o.method.wallet]} · ` : ''}{o.payment === 'failed' ? 'Declined. Nothing was charged.' : 'Paid to your Stripe account'}</span></span><Brand name="stripe" size={30} title /></div></section>
          <section className="w" aria-labelledby="cust"><h2 id="cust" style={{ marginBottom: 12 }}>Customer</h2>
            <div className="row"><Avatar name={o.customer} /><span className="t"><b>{o.customer}</b><span>{o.email}</span></span></div>
            <div className="muted" style={{ marginTop: 12 }}>{o.shipTo}</div></section>
          <section className="w" aria-labelledby="tl"><h2 id="tl" style={{ marginBottom: 14 }}>Timeline</h2>
            <NoteForm orderId={o.id} /><ol className="tl">{[...o.timeline].reverse().map((e, i) => <li key={i} className={e.note ? 'note' : ''}>{e.note ? <><span className="nt">Note{e.by ? ` from ${e.by}` : ''}</span><p>{e.text}</p></> : e.text}<div className="muted" style={{ fontSize: 12 }}>{when(e.at)}</div></li>)}</ol></section>
        </aside>
      </div>
    </>
  );
}
