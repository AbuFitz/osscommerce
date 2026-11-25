import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { CountSheet } from '@/components/stock/CountSheet';
export const metadata = { title: 'Count stock' };
export default async function Count() {
  const rows = (await gateway().stockRows()).filter(r => r.tracked);
  return (<><Header title="Count stock" eyebrow="Count what is on the shelf and fix any differences" back={{ href: '/inventory', label: 'Inventory' }} />
    {rows.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>Nothing to count</b><p style={{ margin: '6px 0 0' }}>Items you count stock for appear here.</p></div> : <CountSheet rows={rows} />}</>);
}
