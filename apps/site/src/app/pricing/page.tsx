import type { Metadata } from 'next';
import { PriceBlock } from '@/components/PriceBlock';
import { Cta } from '@/components/Cta';
import { FeeTable } from '@/components/FeeTable';
import { PRICE } from '@/config';
export const metadata: Metadata = { title: 'Pricing', description: `One plan: ${PRICE.build} to design and build your store, then ${PRICE.monthly} a month for the platform, hosting and technical upkeep.` };

const FAQ = [
  ['Why is there a build fee and a monthly fee?', `They pay for different things. The ${PRICE.build} is for designing and building a storefront that is yours. The ${PRICE.monthly} a month is for the dashboard, hosting and the technical work that keeps the shop running.`],
  ['When does the monthly fee start?', 'Your order form states the start date. It is agreed with you before any work begins.'],
  ['What does it cost to take a payment?', 'A standard UK card payment costs 2% + 20p in total. That is the card processing rate plus our 0.5% platform fee, taken together when the payment is made. Other card types cost more; the table above lists them.'],
  ['Do I pay VAT on top?', 'No. We are not VAT registered, so £479 and £39 are the full prices.'],
  ['What counts as extra work?', 'New design work, additional page types, custom features and connecting services beyond the agreed scope. We quote first; nothing is built or billed until you approve.'],
  ['Who adds the products?', 'You do, from your dashboard, one at a time or by importing a spreadsheet. If you would like us to load a catalogue for you, ask for a quote.'],
  ['Can I leave?', 'Yes. When the service ends we give you an export of your products, orders and customers, and help you move your domain. The terms set out the notice period.'],
] as const;

export default function Pricing() {
  return (<>
    <section className="phd"><div className="wrap"><h1>Built for you once. Looked after every month.</h1><p className="lede">{PRICE.build} gets you a shop designed and built around your business, with no template and no developer to hire. {PRICE.monthly} a month then covers the platform, hosting and upkeep.</p></div></section>
    <section className="sec tight"><div className="wrap"><PriceBlock /></div></section>
    <section className="sec dark glow"><div className="wrap">
      <div className="head split"><h2>Payments, built in.</h2><p className="lede">Taking payments is part of the platform, not an add-on. You see one cost per payment and exactly what lands in your bank.</p></div>
      <FeeTable />
    </div></section>
    <section className="sec"><div className="wrap">
      <div className="head split"><h2>What the build fee replaces.</h2><p className="lede">Getting a shop made properly usually means finding and managing several people. Here it is one team and one price.</p></div>
      <ul className="cols"><li><b>A designer</b><span>Your storefront is designed for your brand, not adapted from a theme.</span></li><li><b>A developer</b><span>We build it, connect it to your dashboard and make it fast on phones.</span></li><li><b>Someone to set it all up</b><span>Payments, delivery and VAT settings are configured with you before launch.</span></li><li><b>Someone to keep it running</b><span>Hosting, updates and monitoring carry on under the monthly fee.</span></li></ul>
    </div></section>
    <section className="sec bone"><div className="wrap">
      <div className="head"><h2>Who does what.</h2></div>
      <div className="tbl">
        <div><h3>We do</h3><ul><li>Design and build the storefront</li><li>Set up payments, delivery and VAT settings with you</li><li>Host, secure, monitor and maintain the platform</li><li>Answer technical questions and fix platform faults</li></ul></div>
        <div><h3>You do</h3><ul><li>Add and price your products</li><li>Fulfil orders and handle refunds</li><li>Look after your customers</li><li>Keep your stock, policies and content up to date</li></ul></div>
        <div><h3>Quoted separately</h3><ul><li>New design work after launch</li><li>Custom features or page types</li><li>Loading a catalogue for you</li><li>Your domain name and optional third-party services</li></ul></div>
      </div>
    </div></section>
    <section className="sec"><div className="wrap"><div className="head"><h2>Questions about pricing.</h2></div>
      <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>
    <Cta />
  </>);
}
