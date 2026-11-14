import Link from 'next/link';
import { Search } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when } from '@/lib/format';
import { Header, PayBadge, FulBadge } from '@/components/ui';

export const metadata = { title: 'Orders' };
const FILTERS = [['', 'All'], ['unfulfilled', 'To fulfil'], ['attention', 'Needs attention'], ['refunded', 'Refunded']] as const;

export default async function Orders({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { filter = '', q = '' } = await searchParams;
  const orders = await gateway().orders({ filter, q });
  return (
    <>
      <Header title="Orders" />
      <div className="toolbar">
        <nav className="seg" aria-label="Filter orders">
          {FILTERS.map(([v, l]) => <Link key={v} href={v ? `/orders?filter=${v}` : '/orders'} aria-current={filter === v}>{l}</Link>)}
        </nav>
        <form className="search" role="search" action="/orders">
          <Search size={16} aria-hidden /><label className="sr" htmlFor="q">Search orders</label>
          <input id="q" name="q" defaultValue={q} placeholder="Order, name or email" />
          {filter && <input type="hidden" name="filter" value={filter} />}
        </form>
      </div>
      <div className="w tw">
        {orders.length === 0 ? <div className="empty">{q || filter ? 'No orders match. Clear the filter to see all orders.' : 'No orders yet. Orders will appear here when customers check out.'}</div> : <>
          <table className="t">
            <thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Customer</th><th scope="col">Payment</th><th scope="col">Fulfilment</th><th scope="col" className="r">Total</th></tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.id}>
                <td><Link className="link" href={`/orders/${o.id}`}>#{o.number}</Link></td>
                <td className="muted">{when(o.placedAt)}</td><td>{o.customer}</td>
                <td><PayBadge s={o.payment} /></td><td><FulBadge s={o.fulfilment} state={o.state} /></td>
                <td className="r num">{money(o.totalMinor)}</td>
              </tr>))}</tbody>
          </table>
          <div className="cards">{orders.map(o => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <b>#{o.number} <span className="muted" style={{ fontWeight: 400 }}>{o.customer}</span></b><b className="num">{money(o.totalMinor)}</b>
              <span className="muted">{when(o.placedAt)}</span><span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}><PayBadge s={o.payment} /><FulBadge s={o.fulfilment} state={o.state} /></span>
            </Link>))}</div>
        </>}
      </div>
    </>
  );
}
