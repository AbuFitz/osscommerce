import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowDownToLine, PackageMinus, PackagePlus, ReceiptText, RotateCcw, Undo2 } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { reasonLabel } from '@/lib/stock';
import { Header } from '@/components/ui';
import { AdjustButton } from '@/components/stock/AdjustButton';
import { StockSettingsForm } from '@/components/stock/StockSettings';
export const metadata = { title: 'Stock history' };
const TEXT = { sale: 'Sold and shipped', reserved: 'Set aside for an order', released: 'Released from a cancelled order', returned: 'Back in stock from a cancelled order', adjusted: 'Changed by hand' } as const;
const ICON = { sale: ReceiptText, reserved: ArrowDownToLine, released: Undo2, returned: RotateCcw, adjusted: PackagePlus } as const;

export default async function StockItem({ params }: { params: Promise<{ id: string }> }) {
  const d = await gateway().stockDetail((await params).id); if (!d) notFound();
  return (<>
    <Header title={`${d.title}${d.variant ? `, ${d.variant}` : ''}`} eyebrow={d.sku} back={{ href: '/inventory', label: 'Inventory' }}><Link className="btn" href={`/products/${d.productId}`}>Open product</Link><AdjustButton row={d} /></Header>
    <div className="kgrid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 16 }}>
      {[['On hand', d.tracked ? d.onHand : '—'], ['Reserved for open orders', d.allocated], ['Available to sell', d.tracked ? d.available : '—']].map(([l, v], i) => <div key={String(l)} className={`w kcard ${i === 2 ? 'dark' : ''}`}><div className="muted">{l}</div><div className="kpi">{v}</div></div>)}
    </div>
    <div className="grid">
      <section className="w c-8" aria-labelledby="sh"><h2 id="sh" style={{ marginBottom: 12 }}>History</h2>
        {d.moves.length === 0 ? <p className="muted">Nothing yet. Every sale, reservation and change you make appears here.</p> : <ol className="sm-list">{d.moves.map(m => { const I = m.kind === 'adjusted' && m.quantity < 0 ? PackageMinus : ICON[m.kind]; return (
          <li key={m.id}><span className="ic lime"><I size={16} aria-hidden /></span><span className="t"><b>{TEXT[m.kind]}</b><span className="muted">{m.kind === 'adjusted' ? [m.reason && reasonLabel(m.reason), m.by, m.note].filter(Boolean).join(' · ') || 'No reason recorded (made before reasons were kept, or by an automatic rule)' : ''}</span></span>
            <span className="r"><b className="num">{m.kind === 'adjusted' ? `${m.quantity > 0 ? '+' : ''}${m.quantity}` : m.kind === 'sale' || m.kind === 'reserved' ? `−${m.quantity}` : `+${m.quantity}`}</b><span className="muted">{when(m.at)}</span></span></li>); })}</ol>}
      </section>
      <aside className="c-4"><section className="w" aria-labelledby="ss"><h2 id="ss" style={{ marginBottom: 12 }}>Stock settings</h2><StockSettingsForm id={d.variantId} initial={{ tracked: d.tracked, backorder: d.backorder, lowAt: d.lowAt }} /></section></aside>
    </div></>);
}
