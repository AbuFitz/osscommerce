import type { Metadata } from 'next';
import { Mark } from '@/components/Marks';
import { Marquee } from '@/components/Marquee';
import { Reveal } from '@/components/Reveal';
import { PageHead, Closing } from '@/components/Sections';
export const metadata: Metadata = { title: 'Integrations', description: 'Payments, shipping, email and more, connected for you.' };
const G = [['Get paid', 'Stripe handles card payments, Apple Pay and Google Pay, with payouts to your bank.', 'stripe'], ['Send the right way', 'Delivery options and tracking set up with the carriers you use.', null], ['Keep customers informed', 'Order confirmations and shipping emails sent from your store.', null], ['Be found', 'Search-friendly structure and product data built in.', null], ['Count the stock', 'Inventory that updates with every sale.', null], ['Anything else you rely on', 'Accounting, marketing and more, connected where we can.', null]] as const;
export default function Page() {
  return (<><PageHead tone="lt" tag="Integrations" title={<>Connected, <span className="grad">so you are not.</span></>} lede="The tools your shop depends on, set up and working together before you open." />
    <Marquee items={['Payments', 'Delivery', 'Email', 'Search', 'Stock', 'Accounting', 'Marketing']} />
    <section className="sec"><div className="wrap mos">{G.map(([b, s, m], i) => (<Reveal key={b} delay={i * 0.05}><div className="m">{m && <span className="lg"><Mark k={m} /></span>}<h3>{b}</h3><p>{s}</p></div></Reveal>))}</div></section>
    <Closing /></>);
}
