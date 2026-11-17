import type { Metadata } from 'next';
import { Mark } from '@/components/Marks';
import { PageHead, Head, Cta } from '@/components/Parts';
export const metadata: Metadata = { title: 'Integrations', description: 'Payments, shipping, email and more, connected for you.' };
const G = [
  ['Get paid', 'Stripe handles card payments, Apple Pay and Google Pay, with payouts to your bank.', 'stripe'],
  ['Send the right way', 'Delivery options and tracking set up with the carriers you use.', null],
  ['Keep customers informed', 'Order confirmations and shipping emails sent from your store.', null],
  ['Be found', 'Search-friendly structure and product data built in.', null],
  ['Count the stock', 'Inventory that updates with every sale.', null],
  ['Anything else you rely on', 'Accounting, marketing and more, connected where we can.', null],
] as const;
export default function Page() {
  return (<><PageHead tag="Integrations" title={<>Connected, <span className="it" style={{ color: 'var(--green)' }}>so you are not.</span></>} lede="The tools your shop depends on, set up and working together before you open." />
    <section className="sec t"><div className="wrap"><Head tag="By what they do" title="Organised by what you need." />
      <ul className="ig">{G.map(([b, s, m]) => <li key={b}><span className="lg">{m ? <Mark k={m} /> : null}</span><b>{b}</b><p>{s}</p></li>)}</ul></div></section>
    <Cta /></>);
}
