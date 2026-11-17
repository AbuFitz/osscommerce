import Link from 'next/link';
import { Boxes, CreditCard, LayoutDashboard } from 'lucide-react';
import { StoreFan } from '@/components/StoreFan';
import { StoreShowcase } from '@/components/StoreShowcase';
import { FulfilDemo, SalesBars, ScanDemo } from '@/components/Bento';
import { Receipt } from '@/components/Receipt';
import { FittingDemo } from '@/components/CustomDemos';
import { Head, Cta, Price } from '@/components/Parts';
import { Reveal } from '@/components/Reveal';
import { PRICE } from '@/config';

const STEPS = [['Tell us about your business', 'A short call about what you sell, who buys it and how you work.'], ['We design your store', 'You see the design and a written scope before anything is built.'], ['We build and connect it', 'Store, dashboard, payments and delivery, set up together.'], ['You start selling', 'Your login, a walkthrough, and a person to ask when you need one.']] as const;
const WHO = ['Food and drink', 'Fashion and streetwear', 'Candles and gifts', 'Beauty and skincare', 'Automotive parts', 'Collectibles', 'Homeware', 'Jewellery', 'Art and prints', 'Pet supplies', 'Health and wellness', 'Makers and craft'];
const CMP = [
  { t: 'DIY store builders', w: 'Fast to start', l: ['A template shared with thousands of shops', 'You do the design, setup and fixing', 'Extra features mean paid apps, each with its own bill', 'Support is a help centre'] },
  { t: 'Agencies', w: 'Fully custom', l: ['Bespoke design, but a large upfront bill', 'Retainers for every change', 'Hosting and security are your problem', 'Slow to change once it ships'] },
  { t: 'OneSimpleCommerce', w: 'Bespoke, run for you', us: true, l: ['A store designed around your brand', 'Dashboard, payments, hosting and security included', 'Custom functionality built in, not bolted on', `${PRICE.build} once, then ${PRICE.monthly} a month`] },
];

export default function Home() {
  return (<>
    <section className="hero"><div className="wrap">
      <p className="tag">Online stores for independent businesses</p>
      <h1 className="d1" style={{ marginTop: 18 }}>We build the store. <span className="it">You run the business.</span></h1>
      <div className="hero-b"><p className="lede">A bespoke online store, a dashboard to run it, payments and delivery set up, all looked after for you. One build, one monthly price.</p>
        <div><div className="acts"><Link className="btn go" href="/start">Start your store</Link><Link className="btn ln" href="/stores">See the stores</Link></div></div></div>
      <StoreFan />
    </div></section>

    <section className="sec t"><div className="wrap"><Reveal><p className="d2" style={{ maxWidth: '24ch' }}>Not a template. Not a toolkit. <span className="it" style={{ color: 'var(--green)' }}>A finished store, built around how you sell.</span></p></Reveal></div></section>

    <section className="sec t"><div className="wrap"><ul className="cols three">
      {([[Boxes, 'Your store', 'Designed around your brand and your products, so it never looks like anyone else’s.'], [LayoutDashboard, 'Your dashboard', 'Orders, stock, customers and sales in one calm place, on your phone or desktop.'], [CreditCard, 'Your payments', 'Cards, Apple Pay and Google Pay, paid to your bank. No juggling providers.']] as const).map(([I, b, s]) => <li key={b}><I size={26} aria-hidden /><b>{b}</b><span>{s}</span></li>)}
    </ul></div></section>

    <section className="sec"><div className="wrap"><Head split tag="The stores" title={<>Every business gets <span className="it">its own</span> store.</>} lede="Four different businesses, four different designs. Same dependable platform underneath." />
      <StoreShowcase /></div></section>

    <section className="sec dark"><div className="wrap"><Head tag="The dashboard" title={<>Run the whole shop <span className="it" style={{ color: 'var(--sig)' }}>from one place.</span></>} lede="Built for people who are busy making and selling, not for IT departments." />
      <div className="bento">
        <div className="bc s5"><h3 className="d3">Fulfil an order in one tap</h3><p className="d">The customer is emailed, the order moves on, and you get on with your day.</p><FulfilDemo /></div>
        <div className="bc k s7" style={{ background: '#161b19' }}><h3 className="d3">See today as it happens</h3><p className="d">Sales, orders and your best sellers, live.</p><SalesBars /></div>
        <div className="bc g s7"><h3 className="d3">Add a product from your phone</h3><p className="d">Point your camera, fill in the details, and it is on your shop.</p><ScanDemo /></div>
        <div className="bc s5"><h3 className="d3">Everything else you would expect</h3><p className="d">Stock, discounts, delivery options, customers and payouts.</p>
          <ul className="chips2 vis">{['Stock', 'Discounts', 'Delivery', 'Customers', 'Refunds', 'Payouts', 'Reports'].map(x => <li key={x}><span>{x}</span></li>)}</ul></div>
      </div></div></section>

    <section className="sec"><div className="wrap"><Head split tag="Custom builds" title={<>Your shop does what <span className="it">your business</span> needs.</>} lede="Fitting by postcode, personalised products, timed offers. If it is how you work, we build it into the store." />
      <FittingDemo /><p style={{ marginTop: 28 }}><Link className="lk" href="/custom">More custom builds →</Link></p></div></section>

    <section className="sec dark"><div className="wrap"><Head tag="Payments" title={<>Know exactly <span className="it" style={{ color: 'var(--sig)' }}>what you keep.</span></>} lede="Drag the order value, choose how the customer paid, and read the receipt. Every figure is worked out the same way the dashboard does it." />
      <Receipt dark /><p style={{ marginTop: 28, opacity: .7, maxWidth: '60ch' }}>Stripe processing costs vary by card type and are shown as published rates. Our fee is 0.5% of each payment.</p></div></section>

    <section className="sec"><div className="wrap"><Head tag="Compared" title={<>Bespoke without the <span className="it">agency bill.</span></>} />
      <div className="cmp">{CMP.map(c => <div key={c.t} className={c.us ? 'us' : ''}><h3 className="d3">{c.t}</h3><p className="w">{c.w}</p><ul>{c.l.map(x => <li key={x}>{x}</li>)}</ul></div>)}</div></div></section>

    <section className="sec"><div className="wrap"><Head tag="How it works" title={<>From first call to <span className="it">first order.</span></>} />
      <ol className="steps">{STEPS.map(([b, t], i) => <li key={b}><span className="mono">0{i + 1}</span><b>{b}</b><span className="t">{t}</span></li>)}</ol></div></section>

    <section className="sec"><div className="wrap"><Head tag="Who it is for" title={<>Built for businesses that <span className="it">make and sell.</span></>} />
      <ul className="ind">{WHO.map(w => <li key={w}>{w}</li>)}</ul></div></section>

    <section className="sec t"><div className="wrap"><Head tag="Pricing" title={<>Simple to <span className="it">understand.</span></>} /><Price /></div></section>
    <Cta />
  </>);
}
