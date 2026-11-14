import { AlertTriangle, Boxes, PackageX } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { Tile } from '@/components/art';
export const metadata = { title: 'Inventory' };

export default async function Inventory() {
  const ps = (await gateway().products()).filter(p => p.status !== 'archived');
  const rows = ps.map(p => ({ ...p, avail: p.onHand - p.allocated, low: p.onHand - p.allocated <= p.threshold })).sort((a, b) => Number(b.low) - Number(a.low) || a.avail - b.avail);
  const units = rows.reduce((s, r) => s + r.onHand, 0), low = rows.filter(r => r.low && r.status === 'published').length, out = rows.filter(r => r.avail <= 0 && r.status === 'published').length;
  return (<>
    <Header title="Inventory" eyebrow="Kiln & Thread · Main stockroom"><button className="btn primary" type="button">Adjust stock</button></Header>
    <div className="kgrid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 16 }}>
      <div className="w kcard"><span className="ic lime"><Boxes size={18} aria-hidden /></span><div className="kpi">{units}</div><div className="muted" style={{ marginTop: 6 }}>Units on hand</div></div>
      <div className="w kcard"><span className="ic peach"><AlertTriangle size={18} aria-hidden /></span><div className="kpi">{low}</div><div className="muted" style={{ marginTop: 6 }}>Low stock</div></div>
      <div className="w kcard"><span className="ic lilac"><PackageX size={18} aria-hidden /></span><div className="kpi">{out}</div><div className="muted" style={{ marginTop: 6 }}>Out of stock</div></div>
    </div>
    <div className="w tw">
      <table className="t"><thead><tr><th scope="col">Product</th><th scope="col" className="r">On hand</th><th scope="col" className="r">Allocated</th><th scope="col">Available</th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id}><td><span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}><Tile seed={p.sku} label={p.title} small /><span><b style={{ fontWeight: 600 }}>{p.title}</b><div className="mono muted">{p.sku}</div></span></span></td><td className="r num">{p.onHand}</td><td className="r num">{p.allocated}</td>
          <td style={{ minWidth: 200 }}><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="num" style={{ minWidth: 24 }}>{p.avail}</span><span className={`meter ${p.low ? 'low' : ''}`} style={{ flex: 1 }} aria-hidden><i style={{ width: `${Math.min(100, (p.avail / Math.max(p.threshold * 3, 1)) * 100)}%` }} /></span>{p.low && <span className="badge warn">Low</span>}</span></td></tr>)}</tbody></table>
      <div className="cards">{rows.map(p => <div key={p.id}><b>{p.title}</b><b className="num">{p.avail}</b><span className="muted mono">{p.onHand} on hand · {p.allocated} allocated</span><span style={{ textAlign: 'right' }}>{p.low && <span className="badge warn">Low stock</span>}</span></div>)}</div>
    </div></>);
}
