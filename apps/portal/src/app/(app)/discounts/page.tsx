import { gateway } from '@/lib/gateway-instance';
import { ymd } from '@/lib/analytics';
import { Header } from '@/components/ui';
import { DiscountCard } from '@/components/discounts/DiscountCard';
import { NewDiscountButton } from '@/components/discounts/NewDiscountButton';
export const metadata = { title: 'Discounts' };

export default async function Discounts() {
  const [ds, products, s] = await Promise.all([gateway().discounts(), gateway().discountProducts(), gateway().summary()]); const today = ymd(s.asOf); const title = new Map(products.map(p => [p.id, p.title]));
  const order = { active: 0, scheduled: 1, paused: 2, expired: 3 } as const; const sorted = [...ds].sort((a, b) => order[a.status] - order[b.status]);
  return (<>
    <Header title="Discounts" eyebrow={`${ds.filter(d => d.status === 'active').length} active · ${ds.filter(d => d.status === 'paused').length} paused`}><NewDiscountButton today={today} /></Header>
    {sorted.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No discounts yet</b><p style={{ margin: '6px 0 0' }}>Create a code to share, or an automatic offer such as buy two get one free. You can pause or edit any of them later.</p></div>
      : <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>{sorted.map(d => <DiscountCard key={d.id ?? d.code} d={d} today={today} productNames={(d.productIds ?? []).map(id => title.get(id)).filter((x): x is string => !!x)} />)}</div>}</>);
}
