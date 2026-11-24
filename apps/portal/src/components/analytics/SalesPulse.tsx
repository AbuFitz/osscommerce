'use client';
import { useEffect, useId, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesPoint } from '@/lib/gateway';
import { money, moneyShort } from '@/lib/format';

const fmtDay = (k: string, long = false) => new Intl.DateTimeFormat('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }).format(new Date(k));

/** The Overview's sales chart: net sales per day with the same hover readout as Analytics. Refunds are the gap between the two lines. */
export function SalesPulse({ series }: { series: SalesPoint[] }) {
  const id = useId(); const [reduce, setReduce] = useState(false); useEffect(() => { setReduce(matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const refunds = series.reduce((s, p) => s + (p.grossMinor - p.netMinor), 0);
  return (<div className="an-plot sm" role="img" aria-label={`Net sales per day, ${fmtDay(series[0].day)} to ${fmtDay(series.at(-1)!.day)}. Total ${money(series.reduce((s, p) => s + p.netMinor, 0))}. The Analytics page has every value in a table.`}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={series} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <defs><linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a6024" stopOpacity=".32" /><stop offset="100%" stopColor="#4a6024" stopOpacity="0" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="rgba(30,40,15,.1)" strokeDasharray="3 4" />
        <XAxis dataKey="day" tickFormatter={k => fmtDay(k)} tickLine={false} axisLine={{ stroke: 'rgba(30,40,15,.16)' }} tick={{ fill: '#6b7260', fontSize: 12 }} minTickGap={34} />
        <YAxis tickFormatter={v => moneyShort(v)} tickLine={false} axisLine={false} width={50} tick={{ fill: '#6b7260', fontSize: 12 }} domain={[0, (m: number) => Math.max(m, 100)]} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: '#232f10', strokeWidth: 1, strokeDasharray: '4 3' }} content={p => {
          if (!p.active || !p.payload?.length) return null; const d = p.payload[0].payload as SalesPoint;
          return (<div className="an-tip" role="status"><p className="an-tip-d">{fmtDay(d.day, true)}</p><p className="an-tip-v"><i className="dot cur" />Net sales<b>{money(d.netMinor)}</b></p>{d.grossMinor !== d.netMinor && <p className="an-tip-v mute"><i className="dot prev" />Before refunds<b>{money(d.grossMinor)}</b></p>}</div>);
        }} />
        {refunds > 0 && <Line type="monotone" dataKey="grossMinor" stroke="#9aa08c" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={!reduce} />}
        <Area type="monotone" dataKey="netMinor" stroke="#4a6024" strokeWidth={2.4} fill={`url(#${id}-g)`} dot={false} activeDot={{ r: 5, fill: '#fff', stroke: '#232f10', strokeWidth: 2.2 }} isAnimationActive={!reduce} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>);
}
