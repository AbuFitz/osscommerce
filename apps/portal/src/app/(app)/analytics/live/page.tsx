import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { LiveMap } from '@/components/live/LiveMap';
import { ArrowDownRight, ArrowUpRight, Radio } from 'lucide-react';
export const metadata = { title: 'Live view' };

const Delta = ({ now, prev }: { now: number; prev: number }) => {
  if (!prev && !now) return <span className="muted">No change</span>;
  const pct = prev ? Math.round(((now - prev) / prev) * 100) : 100; const up = pct >= 0; const I = up ? ArrowUpRight : ArrowDownRight;
  return <span className="delta" data-up={up}><I size={14} aria-hidden />{Math.abs(pct)}%<span className="sr"> {up ? 'up' : 'down'} on the previous period</span></span>;
};

export const dynamic = 'force-dynamic';
export default async function Live() {
  const v = await gateway().live(); const max = Math.max(...v.locations.map(l => l.sessions), 1); const funnel = [['Active carts', v.behaviour.activeCarts], ['Checking out', v.behaviour.checkingOut], ['Purchased', v.behaviour.purchased]] as const; const fmax = Math.max(...funnel.map(f => f[1]), 1);
  const tot = v.returning.newCustomers + v.returning.returning;
  return (<>
    <Header title="Live view" back={{ href: '/analytics', label: 'Analytics' }}><span className="badge line"><Radio size={13} aria-hidden />Live</span></Header>
    {v.demo && <p className="note" style={{ marginBottom: 16 }}>Demo figures. Live numbers come from your store once it is connected.</p>}
    {!v.tracked && <p className="note" style={{ marginBottom: 16 }}>Orders and delivery places are live. Visits and carts need your storefront to send events, which is not switched on yet, so those figures are left out rather than shown as zero.</p>}
    <div className="kgrid live-k">
      <div className="w kcard"><div className="muted">Sales, last 24 hours</div><div className="kpi">{money(v.salesMinor.value)}</div><Delta now={v.salesMinor.value} prev={v.salesMinor.vsPrev} /></div>
      <div className="w kcard"><div className="muted">Orders, last 24 hours</div><div className="kpi">{v.orders.value}</div><Delta now={v.orders.value} prev={v.orders.vsPrev} /></div>
      {v.tracked && <><div className="w kcard"><div className="muted">Visitors right now</div><div className="kpi">{v.visitorsNow}</div></div>
      <div className="w kcard"><div className="muted">Sessions</div><div className="kpi">{v.sessions.value}</div><Delta now={v.sessions.value} prev={v.sessions.vsPrev} /></div></>}
    </div>
    <div style={{ marginTop: 16 }}><LiveMap points={v.points} recent={v.recent} asOf={v.asOf} tracked={v.tracked} /></div>
    <div className="duo" style={{ marginTop: 16 }}>
      {v.tracked && <section className="w" aria-labelledby="l1"><h2 id="l1" style={{ marginBottom: 14 }}>Customer behaviour</h2>
        <ul className="funnel">{funnel.map(([l, n]) => <li key={l}><span>{l}</span><b>{n}</b><i style={{ width: `${(n / fmax) * 100}%` }} aria-hidden /></li>)}</ul></section>}
      <section className="w" aria-labelledby="l2"><h2 id="l2" style={{ marginBottom: 14 }}>New and returning customers</h2>
        {tot === 0 ? <p className="muted">No data for this period yet.</p> : <><div className="split" role="img" aria-label={`${v.returning.newCustomers} new, ${v.returning.returning} returning`}><i style={{ flex: v.returning.newCustomers }} /><i style={{ flex: v.returning.returning }} /></div>
          <dl className="kv"><dt>New</dt><dd>{v.returning.newCustomers}</dd><dt>Returning</dt><dd>{v.returning.returning}</dd></dl></>}</section>
    </div>
    <p className="muted" style={{ margin: '14px 4px 0', fontSize: 12 }}>Place names and positions: <a href="https://www.geonames.org" rel="noreferrer" style={{ textDecoration: 'underline' }}>GeoNames</a> (CC BY 4.0). Country outlines: Natural Earth. Delivery addresses are matched on this server and never sent to a map service.</p>
  </>);
}
