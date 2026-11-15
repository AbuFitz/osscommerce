import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Browser, Shot } from '@/components/Frames';
import { Cta } from '@/components/Cta';
export const metadata: Metadata = { title: 'Platform', description: 'The OSS Commerce dashboard: orders, products, stock, customers, discounts, sales, delivery and content, in one place.' };

const F = [
  { s: 'orders', k: 'ORDERS', h: 'See every order and what it needs.', p: 'A single list with payment and fulfilment status, filters for what is waiting, and search by order, name or email.', l: ['Filter to orders waiting to ship or refunded', 'Open an order for items, customer, payment and timeline'] },
  { s: 'order', k: 'FULFILMENT AND REFUNDS', h: 'Send it, or refund it, in a couple of taps.', p: 'Mark an order as fulfilled with a tracking number, or refund all or part of it and choose whether to put the stock back.', l: ['Full and partial refunds', 'A timeline of what happened and when'] },
  { s: 'product', k: 'PRODUCTS', h: 'Products with real options.', p: 'Sizes, colours and other choices become variants, each with its own SKU, price, stock, VAT class and weight.', l: ['Add products one at a time or import a CSV', 'Add photos from your computer, or straight from your phone with a QR code', 'Group products into collections'] },
  { s: 'inventory', k: 'STOCK', h: 'Know what you have.', p: 'On-hand, reserved and available stock for every product, with low-stock levels you set.', l: ['Adjust stock with a reason, so there is a record', 'Low-stock notifications'] },
  { s: 'discounts', k: 'DISCOUNTS', h: 'Run offers without a developer.', p: 'Percentage, fixed-amount and free-delivery codes, with minimum spend, usage limits and end dates.', l: [] },
  { s: 'analytics', k: 'SALES', h: 'A clear view of how the shop is doing.', p: 'Sales by day net of refunds, average order value, best sellers and order status. View the chart or the figures as a table.', l: [] },
  { s: 'shipping', k: 'DELIVERY AND VAT', h: 'Your delivery rules.', p: 'Zones by country or postcode area, with prices and free-delivery thresholds. Check which zone any postcode falls in.', l: ['VAT classes per variant: standard, reduced or zero'] },
  { s: 'content', k: 'CONTENT', h: 'Keep the words on your store up to date.', p: 'Edit the text on your storefront and your policy pages from the dashboard.', l: [] },
  { s: 'automations', k: 'AUTOMATION', h: 'Routine jobs that run themselves.', p: 'Rules such as emailing you when stock is low or when an order has waited too long.', l: [] },
] as const;

export default function Platform() {
  return (<>
    <section className="phd"><div className="wrap"><h1>The dashboard you run your shop from.</h1><p className="lede">Everything below is the real OSS Commerce dashboard, shown with demo data. It works on a phone as well as it does on a desk.</p>
      <div className="acts"><Link className="btn ink" href="/contact">Start a store <ArrowRight size={18} aria-hidden /></Link></div></div></section>
    <section className="sec tight"><div className="wrap">
      {F.map(f => (<article className="feature" key={f.s}>
        <div><span className="mono muted">{f.k}</span><h2>{f.h}</h2><p>{f.p}</p>{f.l.length > 0 && <ul>{f.l.map(x => <li key={x}>{x}</li>)}</ul>}</div>
        <Browser><Shot name={f.s} alt={`${f.h} Screen from the OSS Commerce dashboard.`} /></Browser>
      </article>))}
      <p className="note" style={{ marginTop: 32 }}>Team roles, a notification centre, keyboard search (Ctrl or ⌘ K) and a help area for service requests are part of the dashboard too.</p>
    </div></section>
    <Cta />
  </>);
}
