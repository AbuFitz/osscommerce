import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when, day } from '@/lib/format';
import { SalesChart } from '@/components/SalesChart';
import { Header, PayBadge, FulBadge } from '@/components/ui';

export default async function Overview() {
  const g = gateway();
  const [s, store, orders] = await Promise.all([g.summary(), g.store(), g.orders()]);
  const todo = orders.filter(o => o.state === 'open');
  const failed = orders.filter(o => o.payment === 'failed');
  const open = store.readiness.filter(r => !r.done);
  return (
    <>
      <Header eyebrow={`${store.name} · last 14 days to ${day(s.asOf)}`} title="Overview">
        <a className="btn" href={`https://${store.store.hostnames[0].host}`} target="_blank" rel="noreferrer">View store <ArrowUpRight size={15} aria-hidden /></a>
      </Header>

      <div className="grid">
        <section className="w dark c-8" aria-labelledby="sales">
          <div className="wh"><h2 id="sales">Net sales</h2><span className="muted">After refunds</span></div>
          <div className="big">{money(s.netMinor)}</div>
          <SalesChart series={s.series} />
        </section>

        <section className="w accent c-4" aria-labelledby="fulfil">
          <div className="wh"><h2 id="fulfil">To fulfil</h2><span className="num" style={{ fontWeight: 600 }}>{s.toFulfil}</span></div>
          <ul className="list">
            {todo.slice(0, 4).map(o => (
              <li key={o.id}><Link href={`/orders/${o.id}`} className="t"><b>#{o.number}</b><div>{o.customer} · {when(o.placedAt)}</div></Link><span className="num">{money(o.totalMinor)}</span></li>
            ))}
          </ul>
          <div style={{ marginTop: 14 }}><Link className="btn primary sm" href="/orders?filter=unfulfilled">Review orders</Link></div>
        </section>

        <div className="w c-3"><div className="muted">Orders</div><div className="kpi">{s.orders}</div></div>
        <div className="w c-3"><div className="muted">Average order</div><div className="kpi">{money(s.aovMinor)}</div></div>
        <div className="w c-3"><div className="muted">Refunded</div><div className="kpi">{money(s.refundedMinor)}</div></div>
        <Link href="/inventory" className="w c-3"><div className="muted">Low stock</div><div className="kpi">{s.lowStock} <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>products</span></div></Link>

        <section className="w c-7" aria-labelledby="recent">
          <div className="wh"><h2 id="recent">Recent orders</h2><Link className="link" href="/orders">All orders</Link></div>
          <ul className="list">
            {orders.slice(0, 5).map(o => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="t"><b>#{o.number}</b> <span className="muted">{o.customer}</span></Link>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><PayBadge s={o.payment} /><span className="num" style={{ minWidth: 64, textAlign: 'right' }}>{money(o.totalMinor)}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w c-5" aria-labelledby="launch">
          <div className="wh"><h2 id="launch">Before you launch</h2><span className="muted num">{store.readiness.length - open.length} of {store.readiness.length}</span></div>
          <ul className="check">
            {store.readiness.map(r => (
              <li key={r.gate}><span className={`tick ${r.done ? 'on' : ''}`}>{r.done && <Check size={12} aria-hidden />}</span>
                <div><span style={{ fontWeight: 550 }}>{r.label}</span><span className="sr">{r.done ? ' — done' : ' — not done'}</span>{!r.done && <small>{r.hint}</small>}</div></li>
            ))}
          </ul>
        </section>

        {failed.length > 0 && (
          <section className="w flat c-12" aria-labelledby="att">
            <div className="wh"><h2 id="att">Needs attention</h2></div>
            <p style={{ margin: 0 }}>{failed.length} payment{failed.length > 1 ? 's' : ''} failed. No customer was charged. <Link className="link" href="/orders?filter=attention">Review</Link></p>
          </section>
        )}
      </div>
      <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>Net sales are after refunds and before Stripe fees. Payouts and fees are in Stripe.</p>
    </>
  );
}
