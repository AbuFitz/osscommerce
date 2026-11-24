import { ExportCustomers } from '@/components/Dialogs';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { CustomerList } from '@/components/customers/CustomerList';
import { countBySegment, segmentsOf } from '@/lib/customers';
export const metadata = { title: 'Customers' };

export default async function Customers() {
  const [cs, s] = await Promise.all([gateway().customers(), gateway().summary()]); const m = segmentsOf(cs, new Date(s.asOf));
  return (<>
    <Header title="Customers" eyebrow={`${cs.length} customer${cs.length === 1 ? '' : 's'}`}><ExportCustomers count={cs.length} /></Header>
    {cs.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No customers yet</b><p style={{ margin: '6px 0 0' }}>People appear here after their first order, with everything they have bought.</p></div>
      : <CustomerList customers={cs} segments={Object.fromEntries([...m].map(([id, set]) => [id, [...set]]))} counts={countBySegment(m)} />}
    <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Customers belong to this store only. Groups such as New and Top spenders are worked out from orders, so they are always up to date.</p></>);
}
