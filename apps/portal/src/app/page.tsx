import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Boxes, Check, CreditCard, Inbox, Package, PartyPopper, ReceiptText, RotateCcw, Wallet } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { plan, type Plan } from '@/lib/smart';
import { money, when, day } from '@/lib/format';
import { SalesBars, Dial, Donut } from '@/components/charts';
import { StillLife } from '@/components/art';
import { Header, Avatar } from '@/components/ui';

const KPI = {
  orders: { l: 'Orders', i: Inbox, t: 'lime', h: '/orders' }, aov: { l: 'Average order', i: ReceiptText, t: 'blue', h: '/analytics' },
  refunded: { l: 'Refunded', i: RotateCcw, t: 'lilac', h: '/orders?filter=refunded' }, lowStock: { l: 'Low stock', i: Boxes, t: 'peach', h: '/inventory' },
  products: { l: 'Products', i: Package, t: 'lime', h: '/products' }, toFulfil: { l: 'To fulfil', i: Inbox, t: 'peach', h: '/orders?filter=unfulfilled' },
} as const;

export default async function Overview() {
  const g = gateway();
  const [s, store, orders, customers, products] = await Promise.all([g.summary(), g.store(), g.orders(), g.customers(), g.products()]);
  const failed = orders.filter(o => o.payment === 'failed').length;
  const P: Plan = plan({ store, summary: s, products: products.length, orders: orders.length, failed });
  const todo = orders.filter(o => o.state === 'open');
  const next = todo[0];
  const done = store.readiness.filter(r => r.done).length;
  const host = store.store.hostnames[0];
  const total = s.statusMix.reduce((a, m) => a + m.count, 0);
  const kval: Record<string, string> = { orders: String(s.orders), aov: money(s.aovMinor), refunded: money(s.refundedMinor), lowStock: String(s.lowStock), products: String(products.length), toFulfil: String(s.toFulfil) };

  const heroCopy: Record<Plan['hero'], { chip: string; h: string; p: string; a?: { href: string; label: string }; b?: { href: string; label: string } }> = {
    first_product: { chip: 'Step 1', h: 'Add your first product', p: 'Your store has nothing to sell yet. Add a product, or import a CSV.', a: { href: '/products', label: 'Add product' }, b: { href: '/products', label: 'Import CSV' } },
    connect_payments: { chip: 'Payments off', h: 'Connect Stripe to accept payments', p: 'Customers cannot check out until your Stripe account is connected. It takes about five minutes.', a: { href: '/settings/payments', label: 'Connect payments' } },
    fulfil: { chip: `${todo.length} waiting to ship`, h: next ? `Order #${next.number} is next` : '', p: next ? `${next.customer} · ${next.lines[0].qty} × ${next.lines[0].title} · ${money(next.totalMinor)}` : '', a: next ? { href: `/orders/${next.id}`, label: 'Open order' } : undefined, b: { href: '/orders?filter=unfulfilled', label: 'All to fulfil' } },
    finish_setup: { chip: `${done} of ${store.readiness.length} done`, h: 'Finish setting up to launch', p: store.readiness.find(r => !r.done)?.hint ?? '', a: { href: '/storefront', label: 'Continue setup' } },
    caught_up: { chip: 'All caught up', h: 'Nothing needs you right now', p: 'New orders will appear here as customers check out.', a: { href: '/analytics', label: 'See how sales are going' } },
  };
  const H = heroCopy[P.hero];

  return (
    <>
      <Header eyebrow={P.showCharts ? `${store.name} · last 14 days to ${day(s.asOf)}` : store.name} title="Overview">
        <a className="btn" href={host.verified ? `https://${host.host}` : '/storefront'}>{host.verified ? 'View store' : 'Preview store'} <ArrowUpRight size={16} aria-hidden /></a>
        {P.hero !== 'first_product' && <Link className="btn primary" href="/products">Add product</Link>}
      </Header>

      {P.attention.length > 0 && (
        <section className="w flat" style={{ marginBottom: 16 }} aria-labelledby="att"><h2 id="att" className="sr">Needs attention</h2>
          {P.attention.map(a => <p key={a} style={{ margin: 0 }}><span className="badge bad">Needs attention</span> <span style={{ marginLeft: 8 }}>{a}</span> <Link className="link" href="/orders?filter=attention">Review</Link></p>)}</section>)}

      <div className="ov">
        <div className="stack">
          <section className="hero" aria-labelledby="hero-t">
            <div>
              <span className="glass">{H.chip}</span>
              <h2 id="hero-t">{H.h}</h2><p>{H.p}</p>
              {P.hero === 'fulfil' && <div className="bar" role="progressbar" aria-label="Orders fulfilled" aria-valuenow={s.fulfilled} aria-valuemin={0} aria-valuemax={Math.max(s.paidOrders, 1)}><i style={{ width: `${(s.fulfilled / Math.max(s.paidOrders, 1)) * 100}%` }} /></div>}
              <div className="acts" style={{ marginTop: P.hero === 'fulfil' ? 0 : 24 }}>
                {H.a && <Link className="btn" href={H.a.href} style={{ color: 'var(--ink)' }}>{H.a.label} <ArrowRight size={16} aria-hidden /></Link>}
                {H.b && <Link className="btn ghost" href={H.b.href}>{H.b.label}</Link>}
              </div>
            </div>
            <div className="art"><StillLife /><span className="glass">Placeholder · add your photography</span></div>
          </section>

          <div className="kgrid">
            {P.kpis.map(k => { const K = KPI[k]; return (
              <Link key={k} href={K.h} className="w kcard"><div className="top2"><span className={`ic ${K.t}`}><K.i size={18} aria-hidden /></span><ArrowUpRight size={16} className="muted" aria-hidden /></div>
                <div className="kpi">{kval[k]}</div><div className="muted" style={{ marginTop: 6 }}>{K.l}</div></Link>); })}
          </div>

          {P.showCharts ? (
            <div className="duo">
              <section className="w tint-yellow" aria-labelledby="sales">
                <div className="wh"><div><h2 id="sales">Net sales</h2><div className="muted" style={{ fontSize: 12.5 }}>After refunds{s.refundedMinor > 0 ? ' · pale bars show sales before refunds' : ''}</div></div></div>
                <div className="big" style={{ marginBottom: 16 }}>{money(s.netMinor)}</div>
                <SalesBars series={s.series} hatch />
              </section>
              <section className="w tint-blue" aria-labelledby="mix">
                <div className="wh"><h2 id="mix">Top products</h2></div>
                <Donut slices={s.topProducts.slice(0, 4).map(p => ({ label: p.title, value: p.netMinor }))} centre={String(s.topProducts.length)} sub="products sold" />
              </section>
            </div>
          ) : (
            <section className="w flat" aria-labelledby="empty-s"><h2 id="empty-s" style={{ marginBottom: 6 }}>Sales</h2><p className="muted" style={{ margin: 0 }}>Sales and top products appear here after your first few orders. Until then there is nothing useful to chart.</p></section>
          )}
        </div>

        <div className="stack">
          {total > 0 && (
            <section className="w dark" aria-labelledby="gauge">
              <div className="wh"><h2 id="gauge">Order status</h2><span className="num" style={{ fontSize: 24, letterSpacing: '-.04em' }}>{total} <small className="muted" style={{ fontSize: 12 }}>orders</small></span></div>
              <div className="dials">
                <Dial value={s.statusMix[1].count} total={total} label="To fulfil" tone="#e4f55e" />
                <Dial value={s.statusMix[0].count} total={total} label="Fulfilled" tone="#b9d3ee" />
                <Dial value={s.statusMix[2].count} total={total} label="Cancelled" tone="#e8764a" />
              </div>
              <div className="cta-strip"><span>{s.fulfilled} of {s.paidOrders} paid orders fulfilled</span><Link className="btn lime sm" href="/orders">Review</Link></div>
            </section>)}

          {todo.length > 0 && P.hero !== 'fulfil' || todo.length > 1 ? (
            <section className="w" aria-labelledby="todo">
              <div className="wh"><h2 id="todo">To fulfil</h2><Link className="link" href="/orders?filter=unfulfilled">See all</Link></div>
              <div className="rows">{todo.slice(0, 4).map((o, i) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="row"><Avatar name={o.customer} i={i} /><span className="t"><b>#{o.number} · {o.customer}</b><span>{when(o.placedAt)}</span></span><span className="num">{money(o.totalMinor)}</span></Link>))}</div>
            </section>) : null}

          {P.showSetup && (
            <section className="w tint-lime" aria-labelledby="launch">
              <div className="wh"><h2 id="launch">Before you launch</h2><span className="num" style={{ fontWeight: 600 }}>{done}/{store.readiness.length}</span></div>
              <ul className="check">{store.readiness.map(r => (
                <li key={r.gate} style={{ background: 'rgba(255,255,255,.45)' }}><span className={`tick ${r.done ? 'on' : ''}`}>{r.done && <Check size={12} aria-hidden />}</span>
                  <div><span style={{ fontWeight: 550 }}>{r.label}</span><span className="sr">{r.done ? ' — done' : ' — not done'}</span>{!r.done && <small>{r.hint}</small>}</div></li>))}</ul>
            </section>)}

          {!P.showSetup && (
            <section className="w" aria-labelledby="live"><div className="wh"><h2 id="live">Your store is live</h2><span className="badge ok">Live</span></div>
              <p className="muted" style={{ margin: 0 }}><PartyPopper size={14} style={{ verticalAlign: '-2px' }} aria-hidden /> {host.host} is taking orders. Checks run every few minutes. <Link className="link" href="/storefront">View status</Link></p></section>)}

          {P.showCustomers && customers.length > 0 && (
            <section className="w" aria-labelledby="cust">
              <div className="wh"><h2 id="cust">Top customers</h2><Link className="link" href="/customers">See all</Link></div>
              <div className="rows">{[...customers].sort((a, b) => b.spentMinor - a.spentMinor).slice(0, 3).map((c, i) => (
                <div key={c.id} className="row"><Avatar name={c.name} i={i + 1} /><span className="t"><b>{c.name}</b><span>{c.orders} order{c.orders > 1 ? 's' : ''}</span></span><span className="num">{money(c.spentMinor)}</span></div>))}</div>
            </section>)}

          {store.store.paymentReadiness === 'not_started' && P.hero !== 'connect_payments' && (
            <Link href="/settings/payments" className="w kcard"><span className="ic lime"><CreditCard size={18} aria-hidden /></span><div style={{ fontWeight: 600, marginTop: 14 }}>Connect payments</div><div className="muted">Needed before customers can check out.</div></Link>)}
        </div>
      </div>
      {P.showCharts && <p className="muted" style={{ marginTop: 18, fontSize: 12 }}><Wallet size={12} style={{ verticalAlign: '-1px' }} aria-hidden /> Net sales are after refunds and before Stripe fees. Payouts and fees are in Stripe.</p>}
    </>
  );
}
