import { notFound } from 'next/navigation';
import Link from 'next/link';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { AdjustButton } from '@/components/stock/AdjustButton';
import { StockSettingsForm } from '@/components/stock/StockSettings';
import { StockHistory } from '@/components/stock/StockHistory';
export const metadata = { title: 'Stock history' };

export default async function StockItem({ params }: { params: Promise<{ id: string }> }) {
  const d = await gateway().stockDetail((await params).id); if (!d) notFound();
  return (<>
    <Header title={`${d.title}${d.variant ? `, ${d.variant}` : ''}`} eyebrow={d.sku} back={{ href: '/inventory', label: 'Inventory' }}><Link className="btn" href={`/products/${d.productId}`}>Open product</Link><AdjustButton row={d} /></Header>
    <div className="kgrid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 16 }}>
      {[['On hand', d.tracked ? d.onHand : '—'], ['Reserved for open orders', d.allocated], ['Available to sell', d.tracked ? d.available : '—']].map(([l, v], i) => <div key={String(l)} className={`w kcard ${i === 2 ? 'dark' : ''}`}><div className="muted">{l}</div><div className="kpi">{v}</div></div>)}
    </div>
    <div className="grid">
      <section className="w c-8" aria-labelledby="sh"><h2 id="sh" style={{ marginBottom: 12 }}>History</h2>
        <StockHistory variantId={d.variantId} first={d.moves} total={d.totalMoves} />
      </section>
      <aside className="c-4"><section className="w" aria-labelledby="ss"><h2 id="ss" style={{ marginBottom: 12 }}>Stock settings</h2><StockSettingsForm id={d.variantId} initial={{ tracked: d.tracked, backorder: d.backorder, lowAt: d.lowAt }} /></section></aside>
    </div></>);
}
