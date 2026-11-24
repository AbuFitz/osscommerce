'use client';
import { useEffect, useId, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AreaChart as AreaIcon, BarChart3, LineChart as LineIcon, Table2 } from 'lucide-react';
import { METRICS, change, metricOf, totalOf, type MetricKey, type Report } from '@/lib/analytics';
import { money, moneyShort } from '@/lib/format';

const fmtDay = (k: string, long = false) => new Intl.DateTimeFormat('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }).format(new Date(`${k}T12:00:00Z`));
const fmt = (v: number, isMoney: boolean, short = false) => (isMoney ? (short ? moneyShort(v) : money(v)) : v.toLocaleString('en-GB'));
type Kind = 'area' | 'bar' | 'line';
type Row = { day: string; cur: number; prev?: number; prevDay?: string };

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  const c = change(now, before);
  if (c === null) return <span className="an-delta flat">New</span>;
  const up = c > 0.05, down = c < -0.05; const good = invert ? down : up; const bad = invert ? up : down;
  return <span className={`an-delta ${good ? 'up' : bad ? 'down' : 'flat'}`} aria-label={`${up ? 'Up' : down ? 'Down' : 'No change'} ${Math.abs(c).toFixed(1)} percent against the previous period`}>{up ? '▲' : down ? '▼' : '•'} {Math.abs(c).toFixed(c >= 100 || c <= -100 ? 0 : 1)}%</span>;
}

function Tip({ active, payload, metric, compare }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; metric: (typeof METRICS)[number]; compare: boolean }) {
  if (!active || !payload?.length) return null; const row = payload[0].payload as Row;
  return (<div className="an-tip" role="status">
    <p className="an-tip-d">{fmtDay(row.day, true)}</p>
    <p className="an-tip-v"><i className="dot cur" />{metric.label}<b>{fmt(row.cur, metric.money)}</b></p>
    {compare && row.prev !== undefined && (<>
      <p className="an-tip-v mute"><i className="dot prev" />{row.prevDay ? fmtDay(row.prevDay) : 'Previous'}<b>{fmt(row.prev, metric.money)}</b></p>
      <p className="an-tip-c"><Delta now={row.cur} before={row.prev} invert={metric.key === 'refunds'} /> vs previous period</p></>)}
  </div>);
}

/** The headline chart. Pick a metric from the tabs, switch the chart type, overlay the previous period, hover or arrow through any day for exact figures. */
export function MainChart({ report, initial = 'net' }: { report: Report; initial?: MetricKey }) {
  const id = useId(); const [key, setKey] = useState<MetricKey>(initial); const [kind, setKind] = useState<Kind>('area'); const [compare, setCompare] = useState(true); const [table, setTable] = useState(false); const [reduce, setReduce] = useState(false);
  useEffect(() => { setReduce(matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const m = METRICS.find(x => x.key === key)!;
  const data: Row[] = report.series.map((d, i) => ({ day: d.day, cur: metricOf(d, key), prev: metricOf(report.prev[i], key), prevDay: report.prev[i].day }));
  const empty = !report.hasData;
  return (<div className="an-main">
    <div className="an-tabs" role="tablist" aria-label="Metric">
      {METRICS.map(x => { const sparkMax = Math.max(...report.series.map(d => metricOf(d, x.key)), 1); const active = x.key === key; const pts = report.series.map((d, i) => `${(i / Math.max(report.series.length - 1, 1)) * 100},${30 - (metricOf(d, x.key) / sparkMax) * 26}`).join(' ');
        return (<button key={x.key} role="tab" id={`${id}-${x.key}`} aria-selected={active} aria-controls={`${id}-panel`} tabIndex={active ? 0 : -1} className="an-tab" onClick={() => setKey(x.key)}
          onKeyDown={e => { const i = METRICS.findIndex(y => y.key === x.key); const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1; if (n >= 0) { e.preventDefault(); const t = METRICS[(n + METRICS.length) % METRICS.length]; setKey(t.key); document.getElementById(`${id}-${t.key}`)?.focus(); } }}>
          <span className="an-tab-l">{x.label}</span>
          <span className="an-tab-v num">{fmt(totalOf(report.totals, x.key), x.money)}</span>
          <span className="an-tab-d"><Delta now={totalOf(report.totals, x.key)} before={totalOf(report.prevTotals, x.key)} invert={x.key === 'refunds'} /></span>
          <svg className="an-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>); })}
    </div>
    <div className="an-bar">
      <p className="an-range muted">{fmtDay(report.from)} to {fmtDay(report.to)}{compare && <> · compared with {fmtDay(report.prevFrom)} to {fmtDay(report.prevTo)}</>}</p>
      <div className="an-ctl">
        <label className="an-check"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Compare to previous period</label>
        <div className="seg-btns" role="group" aria-label="Chart type">
          {([['area', 'Area', AreaIcon], ['bar', 'Bars', BarChart3], ['line', 'Line', LineIcon]] as const).map(([k, l, I]) => <button key={k} type="button" aria-pressed={kind === k && !table} title={l} onClick={() => { setKind(k); setTable(false); }}><I size={16} aria-hidden /><span className="sr">{l}</span></button>)}
          <button type="button" aria-pressed={table} title="Table" onClick={() => setTable(t => !t)}><Table2 size={16} aria-hidden /><span className="sr">Table</span></button>
        </div>
      </div>
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${key}`} className="an-stage">
      {table ? (
        <div className="an-table" tabIndex={0} aria-label={`${m.label} by day, table`}><table><thead><tr><th scope="col">Day</th><th scope="col" className="r">{m.label}</th>{compare && <th scope="col" className="r">Previous period</th>}</tr></thead>
          <tbody>{data.map(r => <tr key={r.day}><td>{fmtDay(r.day, true)}</td><td className="r num">{fmt(r.cur, m.money)}</td>{compare && <td className="r num muted">{fmt(r.prev ?? 0, m.money)}</td>}</tr>)}</tbody></table></div>
      ) : (
        <div className="an-plot" role="img" aria-label={`${m.label} by day from ${fmtDay(report.from)} to ${fmtDay(report.to)}. Total ${fmt(totalOf(report.totals, key), m.money)}. Use the table view for every value.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <defs><linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a6024" stopOpacity=".34" /><stop offset="100%" stopColor="#4a6024" stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="rgba(30,40,15,.09)" strokeDasharray="3 4" />
              <XAxis dataKey="day" tickFormatter={k => fmtDay(k)} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: 'rgba(30,40,15,.16)' }} tick={{ fill: '#6b7260', fontSize: 12 }} minTickGap={36} />
              <YAxis tickFormatter={v => fmt(v, m.money, true)} tickLine={false} axisLine={false} width={m.money ? 52 : 34} tick={{ fill: '#6b7260', fontSize: 12 }} allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
              <Tooltip content={p => <Tip active={p.active} payload={p.payload as ReadonlyArray<{ payload?: unknown }>} metric={m} compare={compare} />} cursor={kind === 'bar' ? { fill: 'rgba(35,47,16,.06)', radius: 8 } : { stroke: '#232f10', strokeWidth: 1, strokeDasharray: '4 3' }} isAnimationActive={false} />
              {compare && kind !== 'bar' && <Line type="monotone" dataKey="prev" stroke="#9aa08c" strokeWidth={1.6} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={!reduce} />}
              {compare && kind === 'bar' && <Bar dataKey="prev" fill="#d8dfc6" radius={[5, 5, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} />}
              {kind === 'area' && <Area type="monotone" dataKey="cur" stroke="#4a6024" strokeWidth={2.4} fill={`url(#${id}-g)`} dot={false} activeDot={{ r: 5, fill: '#fff', stroke: '#232f10', strokeWidth: 2.2 }} isAnimationActive={!reduce} />}
              {kind === 'line' && <Line type="monotone" dataKey="cur" stroke="#4a6024" strokeWidth={2.6} dot={report.days <= 31 ? { r: 3, fill: '#4a6024', strokeWidth: 0 } : false} activeDot={{ r: 5.5, fill: '#fff', stroke: '#232f10', strokeWidth: 2.2 }} isAnimationActive={!reduce} />}
              {kind === 'bar' && <Bar dataKey="cur" fill="#4a6024" radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={!reduce} />}
            </ComposedChart>
          </ResponsiveContainer>
          {empty && <div className="an-empty"><b>No sales in this period</b><span>Pick a longer range, or check back after your first order.</span></div>}
        </div>
      )}
    </div>
  </div>);
}
