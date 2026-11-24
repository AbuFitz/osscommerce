import { notFound } from 'next/navigation';
import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { PrintButton } from '@/components/PrintButton';
export const metadata = { title: 'Packing slip' };

/** A plain page made to be printed: what to put in the parcel and where it goes. No prices, so it can go in the box. */
export default async function Slip({ params }: { params: Promise<{ id: string }> }) {
  const o = await gateway().order((await params).id); if (!o) notFound(); const store = (await gateway().store()).name;
  return (<main className="slip">
    <div className="slip-bar no-print"><PrintButton /></div>
    <header><h1>{store}</h1><p>Packing slip</p></header>
    <section className="slip-meta"><div><b>Order</b>#{o.number}</div><div><b>Placed</b>{when(o.placedAt)}</div><div><b>Ship to</b>{o.customer}<br />{o.shipTo}</div></section>
    <table><thead><tr><th>Item</th><th>SKU</th><th className="r">Qty</th><th className="chk">Packed</th></tr></thead>
      <tbody>{o.lines.map(l => { const todo = l.qty - (l.sent ?? 0); return (<tr key={l.sku}><td>{l.title}{l.variant ? ` (${l.variant})` : ''}</td><td>{l.sku}</td><td className="r">{todo}{l.sent ? ` of ${l.qty}` : ''}</td><td className="chk"><span className="box" /></td></tr>); })}</tbody></table>
    <footer>Thank you for your order.</footer>
  </main>);
}
