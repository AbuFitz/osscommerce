import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
export const metadata = { title: 'Inventory' };

export default async function Inventory() {
  const ps = (await gateway().products()).filter(p => p.status !== 'archived');
  const rows = ps.map(p => ({ ...p, avail: p.onHand - p.allocated, low: p.onHand - p.allocated <= p.threshold })).sort((a, b) => Number(b.low) - Number(a.low) || a.avail - b.avail);
  return (<>
    <Header title="Inventory" />
    <div className="w tw">
      <table className="t"><thead><tr><th scope="col">Product</th><th scope="col" className="r">On hand</th><th scope="col" className="r">Allocated</th><th scope="col">Available</th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id}><td><b style={{ fontWeight: 600 }}>{p.title}</b><div className="mono muted">{p.sku}</div></td><td className="r num">{p.onHand}</td><td className="r num">{p.allocated}</td>
          <td><span className="num">{p.avail}</span> {p.low && <span className="badge warn" style={{ marginLeft: 8 }}>Low stock</span>}<div className={`stock ${p.low ? 'low' : ''}`} aria-hidden><i style={{ width: `${Math.min(100, (p.avail / Math.max(p.threshold * 3, 1)) * 100)}%` }} /></div></td></tr>)}</tbody></table>
      <div className="cards">{rows.map(p => <div key={p.id} className="card"><b>{p.title}</b><b className="num">{p.avail}</b><span className="muted mono">{p.onHand} on hand · {p.allocated} allocated</span><span style={{ textAlign: 'right' }}>{p.low && <span className="badge warn">Low stock</span>}</span></div>)}</div>
    </div></>);
}
