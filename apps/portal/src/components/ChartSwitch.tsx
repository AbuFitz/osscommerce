'use client';
import { useId, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';

/** Chart and table are two views of the same data. The toggle swaps them in place and never changes the card's height: the table scrolls inside the chart's footprint. */
export function ChartSwitch({ chart, table, label }: { chart: React.ReactNode; table: React.ReactNode; label: string }) {
  const id = useId(); const [v, setV] = useState<'chart' | 'table'>('chart');
  return (<div className="cview">
    <div className="cview-bar" role="group" aria-label={`${label}: view`}>
      {([['chart', 'Chart', BarChart3], ['table', 'Table', Table2]] as const).map(([k, l, I]) => <button key={k} type="button" aria-pressed={v === k} aria-controls={`${id}-${k}`} onClick={() => setV(k)}><I size={14} aria-hidden />{l}</button>)}
    </div>
    <div className="cview-stage">
      <div id={`${id}-chart`} className="cview-pane" hidden={v !== 'chart'}>{chart}</div>
      <div id={`${id}-table`} className="cview-pane cview-table" hidden={v !== 'table'} tabIndex={0} aria-label={`${label}, table`}>{table}</div>
    </div>
  </div>);
}
