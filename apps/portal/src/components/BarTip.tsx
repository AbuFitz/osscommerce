'use client';
import { useState } from 'react';
import type { SalesPoint } from '@/lib/gateway';
import { day, money } from '@/lib/format';

/** Hover, touch and keyboard readout for a bar chart. Sits over the SVG, one column per day, so the figures are readable without a table. */
export function BarTip({ series, W, bw, gap }: { series: SalesPoint[]; W: number; bw: number; gap: number }) {
  const [i, setI] = useState<number | null>(null);
  const step = bw + gap; const p = i === null ? null : series[i]; const center = i === null ? 0 : ((i * step + bw / 2) / W) * 100;
  return (<div className="bt" onMouseLeave={() => setI(null)}>
    {series.map((s, n) => (
      <div key={s.day} className="bt-col" style={{ left: `${((n * step - gap / 2) / W) * 100}%`, width: `${(step / W) * 100}%` }} tabIndex={0} role="img" data-on={i === n || undefined}
        aria-label={`${day(s.day)}: sales ${money(s.grossMinor)}, refunds ${money(s.grossMinor - s.netMinor)}, net ${money(s.netMinor)}`}
        onMouseEnter={() => setI(n)} onFocus={() => setI(n)} onBlur={() => setI(null)} onTouchStart={() => setI(n)} />
    ))}
    {p && (<div className="bt-tip" style={{ left: `${Math.min(88, Math.max(12, center))}%` }} aria-hidden>
      <b>{day(p.day)}</b>
      <span><i>Sales</i>{money(p.grossMinor)}</span>
      <span><i>Refunds</i>{money(p.grossMinor - p.netMinor)}</span>
      <span className="tot"><i>Net</i>{money(p.netMinor)}</span>
    </div>)}
  </div>);
}
