import type { Metadata } from 'next';
import { Marquee } from '@/components/Marquee';
import { PageHead, Closing } from '@/components/Sections';
export const metadata: Metadata = { title: 'The platform', description: 'Products, orders, customers, stock and sales in one dashboard.' };
const A = [['Orders', 'See every order, fulfil it, add tracking, refund it, or place one by hand when someone phones.'], ['Products', 'Add products, variants and photos. Import many at once. Edit prices, descriptions and search listings.'], ['Stock', 'Counts update as you sell, with a warning before you run out, history with reasons, and stock counts.'], ['Customers', 'Who bought, what, and how often, with private notes and groups that stay up to date.'], ['Discounts', 'Codes, automatic offers, free delivery over a spend and buy-some-get-some, on a schedule if you like.'], ['Reports', 'Net sales after refunds, best sellers, busy days and a live view of where orders are going.']] as const;
export default function Page() {
  return (<><PageHead tone="dk" tag="The platform" title={<>Run it all <span className="grad">from one place.</span></>} lede="A dashboard made for people who sell. It works on your phone or your desktop, and arranges itself for whichever you have." />
    <Marquee items={['Phone', 'Tablet', 'Desktop', 'Light', 'Dark', 'Fast', 'Simple']} />
    <section className="sec"><div className="wrap"><ul className="rows">{A.map(([b, s]) => (<li key={b}><h3>{b}</h3><p>{s}</p></li>))}</ul></div></section>
    <Closing tone="dk" /></>);
}
