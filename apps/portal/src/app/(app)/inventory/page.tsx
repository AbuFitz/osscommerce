import Link from 'next/link';
import { AlertTriangle, Boxes, ClipboardCheck, PackageX } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { StockTable } from '@/components/stock/StockTable';
export const metadata = { title: 'Inventory' };

export default async function Inventory() {
  const rows = await gateway().stockRows(); const counted = rows.filter(r => r.tracked);
  const units = counted.reduce((s, r) => s + r.onHand, 0), low = rows.filter(r => r.status === 'low' && r.published).length, out = rows.filter(r => r.status === 'out' && r.published).length;
  return (<>
    <Header title="Inventory" eyebrow={`${rows.length} item${rows.length === 1 ? '' : 's'}`}><Link className="btn primary" href="/inventory/count"><ClipboardCheck size={16} aria-hidden />Count stock</Link></Header>
    <div className="kgrid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 16 }}>
      <div className="w kcard"><span className="ic lime"><Boxes size={18} aria-hidden /></span><div className="kpi">{units}</div><div className="muted" style={{ marginTop: 6 }}>Units on hand</div></div>
      <div className="w kcard"><span className="ic peach"><AlertTriangle size={18} aria-hidden /></span><div className="kpi">{low}</div><div className="muted" style={{ marginTop: 6 }}>Low stock</div></div>
      <div className="w kcard"><span className="ic lilac"><PackageX size={18} aria-hidden /></span><div className="kpi">{out}</div><div className="muted" style={{ marginTop: 6 }}>Out of stock</div></div>
    </div>
    {rows.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>Nothing to count yet</b><p style={{ margin: '6px 0 0' }}>Add a product and its stock appears here, item by item.</p></div> : <StockTable rows={rows} />}</>);
}
