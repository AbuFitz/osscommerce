import { gateway } from '@/lib/gateway-instance';
import { money, day } from '@/lib/format';
import { Header } from '@/components/ui';
import { SalesBars, Donut, SLICE } from '@/components/charts';
export const metadata = { title: 'Analytics' };

export default async function Analytics() {
  const s = await gateway().summary();
  const max = Math.max(...s.topProducts.map(p => p.netMinor), 1);
  return (<>
    <Header title="Analytics" eyebrow={`Last 14 days to ${day(s.asOf)} · Europe/London`} />
    <div className="kgrid" style={{ marginBottom: 16 }}>
      {[['Sales before refunds', money(s.grossMinor)], ['Refunded', money(s.refundedMinor)], ['Net sales', money(s.netMinor)], ['Average order', money(s.aovMinor)]].map(([l, v], i) => <div key={l} className={`w kcard ${i === 2 ? 'dark' : ''}`}><div className="muted">{l}</div><div className="kpi">{v}</div></div>)}
    </div>
    <div className="duo">
      <section className="w" aria-labelledby="a1"><div className="wh"><h2 id="a1">Sales by day</h2></div><SalesBars series={s.series} /></section>
      <section className="w" aria-labelledby="a2"><div className="wh"><h2 id="a2">Orders by status</h2></div><Donut slices={s.statusMix.map(m => ({ label: m.label, value: m.count }))} centre={String(s.statusMix.reduce((a, m) => a + m.count, 0))} sub="orders" /></section>
    </div>
    <section className="w" style={{ marginTop: 16 }} aria-labelledby="a3"><div className="wh"><h2 id="a3">Top products</h2><span className="muted">Net of refunds not split per product</span></div>
      <div className="rows">{s.topProducts.map((p, i) => <div key={p.title} className="row"><span className="num muted" style={{ width: 18 }}>{i + 1}</span><span className="t"><b>{p.title}</b></span><span className="meter" style={{ width: 'min(260px,30vw)' }} aria-hidden><i style={{ width: `${(p.netMinor / max) * 100}%`, background: SLICE[i % SLICE.length] }} /></span><span className="num" style={{ minWidth: 80, textAlign: 'right' }}>{money(p.netMinor)}</span></div>)}</div></section>
    <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Sales are order totals, not profit. They exclude Stripe fees. Figures reconcile to the payment ledger once connected.</p></>);
}
