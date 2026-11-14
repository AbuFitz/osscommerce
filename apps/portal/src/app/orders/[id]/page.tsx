import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when } from '@/lib/format';
import { Header, PayBadge, FulBadge } from '@/components/ui';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const o = await gateway().order((await params).id);
  if (!o) notFound();
  const sub = o.lines.reduce((s, l) => s + l.qty * l.unitMinor, 0);
  const canFulfil = o.state === 'open' && o.payment === 'paid';
  return (
    <>
      <Link className="link" href="/orders" style={{ marginBottom: 12 }}><ChevronLeft size={15} aria-hidden />Orders</Link>
      <Header eyebrow={when(o.placedAt)} title={`Order #${o.number}`}>
        {canFulfil && <button className="btn primary" type="button">Mark as fulfilled</button>}
        {o.payment === 'paid' && <button className="btn" type="button">Refund</button>}
      </Header>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}><PayBadge s={o.payment} /><FulBadge s={o.fulfilment} state={o.state} /></div>
      {o.payment === 'failed' && <div className="w flat" style={{ marginBottom: 12 }}>Payment failed. No charge was made and nothing needs fulfilling.</div>}
      <div className="grid">
        <section className="w c-8" aria-labelledby="items">
          <h2 id="items" style={{ marginBottom: 8 }}>Items</h2>
          <ul className="list">{o.lines.map(l => (
            <li key={l.sku}><div className="t"><b>{l.title}</b><div className="mono">{l.sku} · {l.qty} × {money(l.unitMinor)}</div></div><span className="num">{money(l.qty * l.unitMinor)}</span></li>))}</ul>
          <dl className="kv" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 12 }}>
            <dt>Subtotal</dt><dd className="num">{money(sub)}</dd>
            {o.discountMinor > 0 && <><dt>Discount</dt><dd className="num">−{money(o.discountMinor)}</dd></>}
            <dt>Shipping</dt><dd className="num">{o.shippingMinor ? money(o.shippingMinor) : 'Free'}</dd>
            <dt>VAT included</dt><dd className="num">{money(o.taxMinor)}</dd>
            <dt style={{ color: 'var(--ink)', fontWeight: 600 }}>Total</dt><dd className="num" style={{ fontWeight: 600 }}>{money(o.totalMinor)}</dd>
            {o.refundedMinor > 0 && <><dt>Refunded</dt><dd className="num">−{money(o.refundedMinor)}</dd></>}
          </dl>
        </section>
        <aside className="c-4" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <section className="w" aria-labelledby="cust"><h2 id="cust" style={{ marginBottom: 8 }}>Customer</h2><div>{o.customer}</div><div className="muted">{o.email}</div><div className="muted" style={{ marginTop: 8 }}>{o.shipTo}</div></section>
          <section className="w" aria-labelledby="tl"><h2 id="tl" style={{ marginBottom: 12 }}>Timeline</h2>
            <ol className="tl">{o.timeline.map((e, i) => <li key={i}>{e.text}<div className="muted" style={{ fontSize: 12 }}>{when(e.at)}</div></li>)}</ol></section>
        </aside>
      </div>
    </>
  );
}
