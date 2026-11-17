import type { Metadata } from 'next';
import { FulfilDemo, SalesBars, ScanDemo } from '@/components/Bento';
import { PageHead, Head, Cta } from '@/components/Parts';
export const metadata: Metadata = { title: 'The platform', description: 'Products, orders, customers, stock and sales in one dashboard.' };
const A = [['Orders', 'See every order, fulfil it, add tracking, refund it.'], ['Products', 'Add products, variants and photos. Import many at once.'], ['Stock', 'Counts update as you sell, with a warning before you run out.'], ['Customers', 'Who bought, what, and how often.'], ['Discounts', 'Offers and codes you control.'], ['Reports', 'Sales and best sellers, clear at a glance.']] as const;
export default function Page() {
  return (<><PageHead tag="The platform" title={<>Run it all <span className="it" style={{ color: 'var(--green)' }}>from one place.</span></>} lede="A dashboard made for people who sell, on your phone or your desktop." />
    <section className="sec t"><div className="wrap"><div className="bento">
      <div className="bc s4"><h3 className="d3">Fulfil in one tap</h3><FulfilDemo /></div>
      <div className="bc k s4" style={{ background: '#161b19' }}><h3 className="d3">Today, live</h3><SalesBars /></div>
      <div className="bc g s4"><h3 className="d3">Add from your phone</h3><ScanDemo /></div></div></div></section>
    <section className="sec"><div className="wrap"><Head tag="Everything in it" title="The day-to-day, covered." /><ul className="cols">{A.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}</ul></div></section>
    <Cta /></>);
}
