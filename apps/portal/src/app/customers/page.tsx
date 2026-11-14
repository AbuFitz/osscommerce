import { gateway } from '@/lib/gateway-instance';
import { money, day } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Customers' };

export default async function Customers() {
  const cs = await gateway().customers();
  return (<>
    <Header title="Customers" />
    <div className="w tw">
      <table className="t"><thead><tr><th scope="col">Customer</th><th scope="col">Marketing</th><th scope="col" className="r">Orders</th><th scope="col" className="r">Spent</th><th scope="col" className="r">Last order</th></tr></thead>
        <tbody>{cs.map(c => <tr key={c.id}><td><b style={{ fontWeight: 600 }}>{c.name}</b><div className="muted">{c.email}</div></td><td>{c.marketing ? 'Subscribed' : 'Not subscribed'}</td><td className="r num">{c.orders}</td><td className="r num">{money(c.spentMinor)}</td><td className="r muted">{day(c.lastOrder)}</td></tr>)}</tbody></table>
      <div className="cards">{cs.map(c => <div key={c.id} className="card"><b>{c.name}</b><b className="num">{money(c.spentMinor)}</b><span className="muted">{c.email}</span><span className="muted" style={{ textAlign: 'right' }}>{c.orders} order{c.orders > 1 ? 's' : ''}</span></div>)}</div>
    </div>
    <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Customers belong to this store only.</p></>);
}
