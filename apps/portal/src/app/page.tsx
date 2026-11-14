import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Boxes, Check, Inbox, ReceiptText, RotateCcw, Wallet } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when, day } from '@/lib/format';
import { SalesBars, Gauge, Donut } from '@/components/charts';
import { StillLife } from '@/components/art';
import { Header, PayBadge, Avatar } from '@/components/ui';

export default async function Overview() {
  const g = gateway();
  const [s, store, orders, customers] = await Promise.all([g.summary(), g.store(), g.orders(), g.customers()]);
  const todo = orders.filter(o => o.state === 'open');
  const done = store.readiness.filter(r => r.done).length;
  const failed = orders.filter(o => o.payment === 'failed').length;
  const next = todo[0];
  return (
    <>
      <Header eyebrow={`${store.name} · last 14 days to ${day(s.asOf)}`} title="Overview">
        <a className="btn" href={store.store.hostnames[0].verified ? `https://${store.store.hostnames[0].host}` : '/storefront'}>View store <ArrowUpRight size={16} aria-hidden /></a>
        <Link className="btn primary" href="/products">Add product</Link>
      </Header>

      <div className="ov">
        <div className="stack">
          <section className="hero" aria-labelledby="hero-t">
            <div>
              <span className="glass">{todo.length} waiting to ship</span>
              <h2 id="hero-t">{next ? `Order #${next.number} is next` : 'You are all caught up'}</h2>
              <p>{next ? `${next.customer} · ${next.lines[0].qty} × ${next.lines[0].title} · ${money(next.totalMinor)}` : 'New orders will appear here as customers check out.'}</p>
              <div className="bar" role="progressbar" aria-label="Orders fulfilled" aria-valuenow={s.fulfilled} aria-valuemin={0} aria-valuemax={s.paidOrders}><i style={{ width: `${(s.fulfilled / Math.max(s.paidOrders, 1)) * 100}%` }} /></div>
              <div className="acts">
                {next && <Link className="btn" href={`/orders/${next.id}`} style={{ color: 'var(--ink)' }}>Open order <ArrowRight size={16} aria-hidden /></Link>}
                <Link className="btn ghost" href="/orders?filter=unfulfilled">All to fulfil</Link>
              </div>
            </div>
            <div className="art"><StillLife /><span className="glass">Image placeholder · add your photography</span></div>
          </section>

          <div className="kgrid">
            {[
              { l: 'Orders', v: String(s.orders), i: Inbox, t: 'lime', h: '/orders' },
              { l: 'Average order', v: money(s.aovMinor), i: ReceiptText, t: 'blue', h: '/analytics' },
              { l: 'Refunded', v: money(s.refundedMinor), i: RotateCcw, t: 'lilac', h: '/orders?filter=refunded' },
              { l: 'Low stock', v: String(s.lowStock), i: Boxes, t: 'peach', h: '/inventory', u: 'products' },
            ].map(k => (
              <Link key={k.l} href={k.h} className="w kcard"><div className="top2"><span className={`ic ${k.t}`}><k.i size={18} aria-hidden /></span><ArrowUpRight size={16} className="muted" aria-hidden /></div>
                <div className="kpi">{k.v} {k.u && <small>{k.u}</small>}</div><div className="muted" style={{ marginTop: 6 }}>{k.l}</div></Link>
            ))}
          </div>

          <div className="duo">
            <section className="w" aria-labelledby="sales">
              <div className="wh"><div><h2 id="sales">Net sales</h2><div className="muted" style={{ fontSize: 12.5 }}>After refunds · pale bars show sales before refunds</div></div></div>
              <div className="big" style={{ marginBottom: 16 }}>{money(s.netMinor)}</div>
              <SalesBars series={s.series} />
            </section>
            <section className="w" aria-labelledby="mix">
              <div className="wh"><h2 id="mix">Top products</h2></div>
              <Donut slices={s.topProducts.slice(0, 4).map(p => ({ label: p.title, value: p.netMinor }))} centre={String(s.topProducts.length)} sub="products sold" />
            </section>
          </div>
        </div>

        <div className="stack">
          <section className="w dark" aria-labelledby="gauge">
            <div className="wh"><h2 id="gauge">Fulfilment</h2><span className="muted">Last 14 days</span></div>
            <Gauge value={s.fulfilled} total={s.paidOrders} label="Orders fulfilled" sub={`${s.fulfilled} of ${s.paidOrders} paid orders`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', textAlign: 'center', marginTop: 18 }}>
              {s.statusMix.map(m => <div key={m.label}><div className="kpi" style={{ margin: 0, fontSize: 24 }}>{m.count}</div><div className="muted" style={{ fontSize: 12 }}>{m.label}</div></div>)}
            </div>
          </section>

          <section className="w" aria-labelledby="todo">
            <div className="wh"><h2 id="todo">To fulfil</h2><Link className="link" href="/orders?filter=unfulfilled">See all</Link></div>
            <div className="rows">
              {todo.slice(0, 4).map((o, i) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="row"><Avatar name={o.customer} i={i} /><span className="t"><b>#{o.number} · {o.customer}</b><span>{when(o.placedAt)}</span></span><span className="num">{money(o.totalMinor)}</span></Link>
              ))}
              {todo.length === 0 && <div className="empty">Nothing waiting. Orders will appear here when customers check out.</div>}
            </div>
          </section>

          <section className="w tint-lime" aria-labelledby="launch">
            <div className="wh"><h2 id="launch">Before you launch</h2><span className="num" style={{ fontWeight: 600 }}>{done}/{store.readiness.length}</span></div>
            <ul className="check">
              {store.readiness.map(r => (
                <li key={r.gate} style={{ background: 'rgba(255,255,255,.45)' }}><span className={`tick ${r.done ? 'on' : ''}`}>{r.done && <Check size={12} aria-hidden />}</span>
                  <div><span style={{ fontWeight: 550 }}>{r.label}</span><span className="sr">{r.done ? ' — done' : ' — not done'}</span>{!r.done && <small>{r.hint}</small>}</div></li>
              ))}
            </ul>
          </section>

          <section className="w" aria-labelledby="cust">
            <div className="wh"><h2 id="cust">Top customers</h2><Link className="link" href="/customers">See all</Link></div>
            <div className="rows">{[...customers].sort((a, b) => b.spentMinor - a.spentMinor).slice(0, 3).map((c, i) => (
              <div key={c.id} className="row"><Avatar name={c.name} i={i + 1} /><span className="t"><b>{c.name}</b><span>{c.orders} orders</span></span><span className="num">{money(c.spentMinor)}</span></div>))}</div>
          </section>

          {failed > 0 && <section className="w flat" aria-labelledby="att"><h2 id="att" style={{ marginBottom: 6 }}>Needs attention</h2><p style={{ margin: 0 }}>{failed} payment failed. No customer was charged. <Link className="link" href="/orders?filter=attention">Review</Link></p></section>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 18, fontSize: 12 }}><Wallet size={12} style={{ verticalAlign: '-1px' }} aria-hidden /> Net sales are after refunds and before Stripe fees. Payouts and fees are in Stripe.</p>
    </>
  );
}
