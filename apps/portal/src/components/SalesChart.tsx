import type { SalesPoint } from '@/lib/gateway';
import { day, moneyShort, money } from '@/lib/format';

/** Server-rendered SVG: no chart library needed for one bar series. Data table is the accessible equivalent. */
export function SalesChart({ series }: { series: SalesPoint[] }) {
  const max = Math.max(...series.map(s => s.netMinor), 1);
  const W = 560, H = 150, gap = 6, bw = (W - gap * (series.length - 1)) / series.length;
  const total = series.reduce((s, p) => s + p.netMinor, 0);
  const best = series.reduce((a, b) => (b.netMinor > a.netMinor ? b : a));
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none" role="img"
        aria-label={`Net sales per day, ${day(series[0].day)} to ${day(series.at(-1)!.day)}. Total ${money(total)}. Best day ${day(best.day)} at ${money(best.netMinor)}.`}>
        {series.map((p, i) => {
          const h = Math.max(2, (p.netMinor / max) * H);
          return <rect key={p.day} className={i === series.length - 1 ? 'last' : ''} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={3} />;
        })}
        <text x={0} y={H + 12}>{day(series[0].day)}</text>
        <text x={W} y={H + 12} textAnchor="end">{day(series.at(-1)!.day)}</text>
      </svg>
      <details className="data"><summary>View as table</summary>
        <table><tbody>{series.map(p => <tr key={p.day}><td style={{ paddingRight: 16 }}>{day(p.day)}</td><td className="num">{moneyShort(p.netMinor)}</td></tr>)}</tbody></table>
      </details>
    </>
  );
}
