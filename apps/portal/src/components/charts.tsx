import type { SalesPoint } from '@/lib/gateway';
import { day, money, moneyShort } from '@/lib/format';
import { ChartSwitch } from './ChartSwitch';

/** Gross (pale) behind net (mid): the gap is refunds. Peak day is emphasised with a label. Data table is the accessible equivalent. */
export function SalesBars({ series, hatch = false }: { series: SalesPoint[]; hatch?: boolean }) {
  const W = 560, H = 190, base = 150, gap = 8, bw = (W - gap * (series.length - 1)) / series.length;
  const max = Math.max(...series.map(s => s.grossMinor), 1);
  const peak = series.reduce((a, b) => (b.netMinor > a.netMinor ? b : a));
  const total = series.reduce((s, p) => s + p.netMinor, 0);
  return (
    <ChartSwitch label="Net sales per day" chart={<>
      <svg className={`chart ${hatch ? 'hatch' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net sales per day, ${day(series[0].day)} to ${day(series.at(-1)!.day)}. Total ${money(total)}. Best day ${day(peak.day)}, ${money(peak.netMinor)}.`}>
        {hatch && <defs>
          {[['l', 'rgba(60,45,0,.18)'], ['m', 'rgba(60,45,0,.42)'], ['d', 'rgba(35,25,0,.8)']].map(([k, c]) => (
            <pattern key={k} id={`dots-${k}`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.15" fill={c} /></pattern>))}
        </defs>}
        {series.map((p, i) => {
          const x = i * (bw + gap), hg = Math.max(6, (p.grossMinor / max) * (base - 34)), hn = Math.max(p.netMinor > 0 ? 6 : 0, (p.netMinor / max) * (base - 34));
          const isPeak = p === peak && p.netMinor > 0;
          return (
            <g key={p.day}>
              <rect className="g" x={x} y={base - hg} width={bw} height={hg} rx={Math.min(10, bw / 2.4)} />
              {hn > 0 && <rect className={isPeak ? 'pk' : 'n'} x={x} y={base - hn} width={bw} height={hn} rx={Math.min(10, bw / 2.4)} />}
              {isPeak && (<g><rect x={x + bw / 2 - 34} y={base - hg - 32} width={68} height={24} rx={12} fill="#14170f" /><text x={x + bw / 2} y={base - hg - 16} textAnchor="middle" style={{ fill: '#fff', fontSize: 12, fontWeight: 600 }}>{moneyShort(p.netMinor)}</text></g>)}
              {(i % 3 === 0 || i === series.length - 1) && <text x={x + bw / 2} y={base + 24} textAnchor="middle">{day(p.day)}</text>}
            </g>
          );
        })}
      </svg>
      </>} table={<table><thead><tr><th scope="col">Day</th><th scope="col">Sales</th><th scope="col">Net</th></tr></thead><tbody>{series.map(p => <tr key={p.day}><td>{day(p.day)}</td><td className="num">{money(p.grossMinor)}</td><td className="num">{money(p.netMinor)}</td></tr>)}</tbody></table>} />
  );
}

export function Gauge({ value, total, label, sub }: { value: number; total: number; label: string; sub: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div role="img" aria-label={`${label}: ${pct}%. ${sub}`} style={{ position: 'relative', maxWidth: 260, margin: '0 auto' }}>
      <svg viewBox="0 0 220 128" width="100%" aria-hidden>
        <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stopColor="#7d9a3f" /><stop offset="1" stopColor="#e8f2c8" /></linearGradient></defs>
        <path d="M 20 110 A 90 90 0 0 1 200 110" pathLength={100} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="16" strokeLinecap="round" />
        <path d="M 20 110 A 90 90 0 0 1 200 110" pathLength={100} fill="none" stroke="url(#gg)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${pct} 100`} />
      </svg>
      <div style={{ position: 'absolute', inset: 'auto 0 6px', textAlign: 'center' }}>
        <div className="big" style={{ fontSize: 46 }}>{pct}%</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{sub}</div>
      </div>
    </div>
  );
}

export const SLICE = ['#4a6024', '#b9d072', '#b9d3ee', '#cfc2f3', '#efc9a6'];
export function Donut({ slices, centre, sub }: { slices: { label: string; value: number }[]; centre: string; sub: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div>
      <div style={{ position: 'relative', width: 170, margin: '4px auto 18px' }}>
        <svg viewBox="0 0 42 42" role="img" aria-label={slices.map(s => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="rgba(30,40,15,.07)" strokeWidth="5.5" />
          {slices.map((s, i) => { const p = (s.value / total) * 100, off = -acc; acc += p;
            return <circle key={s.label} cx="21" cy="21" r="15.9155" fill="none" stroke={SLICE[i % SLICE.length]} strokeWidth="5.5" strokeLinecap="butt" pathLength={100} strokeDasharray={`${Math.max(p - 1.2, 0)} ${100 - Math.max(p - 1.2, 0)}`} strokeDashoffset={off} transform="rotate(-90 21 21)" />; })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}><div className="kpi" style={{ margin: 0, fontSize: 26 }}>{centre}</div><div className="muted" style={{ fontSize: 12 }}>{sub}</div></div>
      </div>
      <ul className="legend">{slices.map((s, i) => <li key={s.label}><i style={{ background: SLICE[i % SLICE.length] }} /><span>{s.label}</span><span className="num">{Math.round((s.value / total) * 100)}%</span></li>)}</ul>
    </div>
  );
}

/** Pie dial: DINEOS-style status gauge for dark widgets. Value is a share of total. */
export function Dial({ value, total, label, tone }: { value: number; total: number; label: string; tone: string }) {
  const pct = total ? (value / total) * 100 : 0, r = 12.5, c = 2 * Math.PI * r;
  return (
    <div className="dial" role="img" aria-label={`${label}: ${value} of ${total}, ${Math.round(pct)}%`}>
      <b>{Math.round(pct)}<small>%</small></b>
      <svg viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth=".6" strokeDasharray="1 2" />
        <circle cx="16" cy="16" r="11" fill="rgba(255,255,255,.07)" />
        <circle cx="16" cy="16" r={r / 2} fill="none" stroke={tone} strokeWidth={r} strokeDasharray={`${(pct / 100) * (c / 2)} ${c}`} transform="rotate(-90 16 16)" />
      </svg>
      <span>{label} ({value})</span>
    </div>
  );
}
