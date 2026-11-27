import { gate } from '@/lib/gate';
import { Suspense } from 'react';
import Link from 'next/link';
import { Eye, Radio, Tag } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { buildReport, resolveRange, ymd } from '@/lib/analytics';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { Donut } from '@/components/charts';
import { MainChart } from '@/components/analytics/MainChart';
import { RangePicker } from '@/components/analytics/RangePicker';
import { CustomerMix, Methods, TopProducts, Weekdays } from '@/components/analytics/Breakdowns';
export const metadata = { title: 'Analytics' };

const dmy = (k: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${k}T12:00:00Z`));

export default async function Analytics({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await gate('/analytics');
  const q = await searchParams; const today = ymd((await gateway().summary()).asOf);
  const range = resolveRange(q, today); const days = Math.round((Date.parse(`${range.to}T12:00:00Z`) - Date.parse(`${range.from}T12:00:00Z`)) / 86400_000) + 1;
  const prevFrom = ymd(new Date(Date.parse(`${range.from}T12:00:00Z`) - days * 86400_000));
  const r = buildReport(await gateway().reportOrders(prevFrom), range);
  return (<>
    <Header title="Analytics" eyebrow={`${dmy(range.from)} to ${dmy(range.to)} · Europe/London`}>
      <Suspense fallback={null}><RangePicker label={range.label} from={range.from} to={range.to} today={today} /></Suspense>
      <Link className="btn" href="/analytics/visitors"><Eye size={16} aria-hidden />Visitors</Link><Link className="btn" href="/analytics/live"><Radio size={16} aria-hidden />Live view</Link>
    </Header>
    <section className="w an-card" aria-label="Sales over time"><MainChart report={r} /></section>
    <div className="an-grid">
      <section className="w" aria-labelledby="b1"><div className="wh"><h2 id="b1">Top products</h2><span className="muted">By sales before refunds</span></div><TopProducts items={r.topProducts} /></section>
      <section className="w" aria-labelledby="b2"><div className="wh"><h2 id="b2">Sales by day of week</h2></div><Weekdays items={r.weekday} /></section>
      <section className="w" aria-labelledby="b3"><div className="wh"><h2 id="b3">New and returning customers</h2></div><CustomerMix c={r.customers} /></section>
      <section className="w" aria-labelledby="b4"><div className="wh"><h2 id="b4">How customers paid</h2></div><Methods items={r.methods} /></section>
      <section className="w" aria-labelledby="b5"><div className="wh"><h2 id="b5">Orders by status</h2></div>
        <Donut slices={r.status.map(m => ({ label: m.label, value: m.count }))} centre={String(r.status.reduce((a, m) => a + m.count, 0))} sub="orders" /></section>
      <section className="w" aria-labelledby="b6"><div className="wh"><h2 id="b6">Discounts</h2></div>
        <div className="an-disc"><Tag size={22} aria-hidden /><p className="num">{money(r.discounts.amount)}</p><p className="muted">given across {r.discounts.orders} order{r.discounts.orders === 1 ? '' : 's'}{r.totals.orders ? ` (${Math.round((r.discounts.orders / r.totals.orders) * 100)}% of orders)` : ''}</p></div></section>
    </div>
    <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Sales are order totals, not profit. They exclude Stripe fees. A refund is counted on the day of the order it belongs to. Figures reconcile to the payment ledger once connected.</p>
  </>);
}
