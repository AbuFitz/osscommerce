import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { ManualOrderForm } from '@/components/orders/ManualOrderForm';
export const metadata = { title: 'Create order' };
export default async function NewOrder() {
  const g = gateway(); const [items, shipping, customers] = await Promise.all([g.orderableItems(), g.shippingChoices(), g.customers()]);
  return (<><Header title="Create order" eyebrow="For a sale by phone, message or in person" back={{ href: '/orders', label: 'Orders' }} />
    {items.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>Nothing to sell yet</b><p style={{ margin: '6px 0 0' }}>Publish a product with stock first, then you can take orders by hand.</p></div> : <ManualOrderForm items={items} shipping={shipping} customers={customers} />}</>);
}
