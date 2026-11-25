'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Report } from '@/lib/analytics';
import { money, moneyShort } from '@/lib/format';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function TopProducts({ items }: { items: Report['topProducts'] }) {
  const max = Math.max(...items.map(i => i.gross), 1), total = items.reduce((s, i) => s + i.gross, 0);
  if (!items.length) return <p className="muted an-none">No products sold in this period.</p>;
  return (<ol className="an-rank">{items.map((p, i) => (
    <li key={p.title}><span className="n muted">{i + 1}</span><div className="b"><div className="r1"><b>{p.title}</b><span className="num">{money(p.gross)}</span></div>
      <div className="meter" role="img" aria-label={`${p.title}: ${pct(p.gross, total)} percent of top-product sales`}><i style={{ width: `${(p.gross / max) * 100}%` }} /></div>
      <small className="muted">{p.units} sold · {pct(p.gross, total)}% of these sales</small></div></li>))}</ol>);
}

export function Weekdays({ items }: { items: Report['weekday'] }) {
  const best = items.reduce((a, b) => (b.gross > a.gross ? b : a), items[0]);
  return (<div className="an-wd"><div role="img" aria-label={`Sales by day of week. ${best.gross ? `${best.label} is strongest at ${money(best.gross)}.` : 'No sales yet.'}`}>
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={items} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(26,26,29,.09)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'rgba(26,26,29,.16)' }} tick={{ fill: '#64646e', fontSize: 12 }} />
        <YAxis tickFormatter={v => moneyShort(v)} tickLine={false} axisLine={false} width={48} tick={{ fill: '#64646e', fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(30,30,33,.06)', radius: 8 }} isAnimationActive={false} content={({ active, payload }) => active && payload?.length ? <div className="an-tip"><p className="an-tip-d">{(payload[0].payload as Report['weekday'][number]).label}</p><p className="an-tip-v">Sales<b>{money(payload[0].payload.gross)}</b></p><p className="an-tip-v mute">Orders<b>{payload[0].payload.orders}</b></p></div> : null} />
        <Bar dataKey="gross" radius={[6, 6, 0, 0]} fill="#3cc46a" maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer></div></div>);
}

export function CustomerMix({ c }: { c: Report['customers'] }) {
  const n = c.new + c.returning;
  if (!n) return <p className="muted an-none">No orders in this period.</p>;
  return (<div className="an-mix"><div className="an-split" role="img" aria-label={`${pct(c.new, n)} percent of orders from new customers, ${pct(c.returning, n)} percent from returning customers`}><i className="new" style={{ width: `${pct(c.new, n)}%` }} /><i className="ret" style={{ width: `${100 - pct(c.new, n)}%` }} /></div>
    <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>A customer counts as new on their first order in this store's history shown here, and as returning after that.</p><dl><div><dt><i className="dot new" />New customers</dt><dd><b className="num">{c.new}</b> orders · {money(c.newGross)}</dd></div><div><dt><i className="dot ret" />Returning customers</dt><dd><b className="num">{c.returning}</b> orders · {money(c.returningGross)}</dd></div></dl></div>);
}

export function Methods({ items }: { items: Report['methods'] }) {
  const total = items.reduce((s, i) => s + i.gross, 0); if (!items.length) return <p className="muted an-none">No payments in this period.</p>;
  return (<ul className="an-list">{items.map(m => <li key={m.label}><span>{m.label}</span><div className="meter"><i style={{ width: `${pct(m.gross, total)}%` }} /></div><span className="num">{pct(m.gross, total)}%</span><small className="muted">{m.orders} orders</small></li>)}</ul>);
}
