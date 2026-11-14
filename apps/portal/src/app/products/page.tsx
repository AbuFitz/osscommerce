import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Products' };
const tone = { published: 'ok', draft: 'warn', archived: '' } as const;
const label = { published: 'Published', draft: 'Draft', archived: 'Archived' } as const;

export default async function Products() {
  const ps = await gateway().products();
  return (<>
    <Header title="Products"><button className="btn primary" type="button">Add product</button></Header>
    <div className="w tw">
      <table className="t"><thead><tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">SKU</th><th scope="col" className="r">Price</th><th scope="col" className="r">Available</th></tr></thead>
        <tbody>{ps.map(p => <tr key={p.id}><td><b style={{ fontWeight: 600 }}>{p.title}</b><div className="muted">{p.variants} variant{p.variants > 1 ? 's' : ''}</div></td><td><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span></td><td className="mono">{p.sku}</td><td className="r num">{money(p.priceMinor)}</td><td className="r num">{p.onHand - p.allocated}</td></tr>)}</tbody></table>
      <div className="cards">{ps.map(p => <div key={p.id} className="card"><b>{p.title}</b><b className="num">{money(p.priceMinor)}</b><span className="muted mono">{p.sku}</span><span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span><span className="muted num">{p.onHand - p.allocated} avail.</span></span></div>)}</div>
    </div></>);
}
