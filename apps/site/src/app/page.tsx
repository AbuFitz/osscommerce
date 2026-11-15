import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Browser, Phone, Shot } from '@/components/Frames';
import { StoreDemo } from '@/components/StoreDemo';
import { LiveDemo } from '@/components/LiveDemo';
import { PayCalc } from '@/components/PayCalc';
import { Reveal } from '@/components/Reveal';
import { Cta } from '@/components/Cta';
import { Showcase } from '@/components/Showcase';

export default function Home() {
  return (<>
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker">A product by OneSimpleSite</p>
          <h1>We build the store. <em>You run the business.</em></h1>
          <p className="lede">A bespoke online store, a powerful commerce platform, and a team that takes care of the technology.</p>
          <div className="acts"><Link className="btn bone" href="/start">Start your store</Link><Link className="btn glass" href="/how-it-works">How it works</Link></div>
        </div>
        <LiveDemo />
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <h2 className="statement">Sell with a store made for you. <span>Run it from one dashboard.</span></h2>
        <div className="bento">
          <Reveal className="b b-store"><Link href="/features/online-store" className="b-in"><div className="b-txt"><p className="mono">Online store</p><h3>Designed for your brand, built by us.</h3></div><div className="b-vis"><Browser url="kilnandthread.example"><StoreDemo /></Browser></div><ArrowRight className="b-go" size={20} aria-hidden /></Link></Reveal>
          <Reveal className="b b-orders" i={1}><Link href="/features/orders" className="b-in"><div className="b-txt"><p className="mono">Orders</p><h3>Send it or refund it in a couple of taps.</h3></div><div className="b-vis ph"><Phone><Shot name="m-order" alt="An order open on a phone, ready to mark as fulfilled" mobile /></Phone></div><ArrowRight className="b-go" size={20} aria-hidden /></Link></Reveal>
          <Reveal className="b b-prod" i={1}><Link href="/features/products" className="b-in"><div className="b-txt"><p className="mono">Products and stock</p><h3>Variants, collections and stock you can trust.</h3></div><div className="b-vis crop"><Shot name="inventory" alt="Stock levels in the dashboard" /></div><ArrowRight className="b-go" size={20} aria-hidden /></Link></Reveal>
          <Reveal className="b b-an" i={2}><Link href="/features/analytics" className="b-in"><div className="b-txt"><p className="mono">Analytics</p><h3>Know how the shop is doing.</h3></div><div className="b-vis crop"><Shot name="analytics" alt="Sales by day in the dashboard" /></div><ArrowRight className="b-go" size={20} aria-hidden /></Link></Reveal>
        </div>
      </div>
    </section>

    <section className="sec tight">
      <div className="wrap">
        <div className="head split"><h2>See it working.</h2><p className="lede">An order comes in, you send it, the customer is told. This is the real dashboard, recorded with demo data.</p></div>
        <Showcase />
      </div>
    </section>

    <section className="sec bone">
      <div className="wrap">
        <div className="head split"><h2>Payments, built in.</h2><p className="lede">Take cards and wallets from day one. Every payment shows what it cost and what you received, and payouts go straight to your bank. Try your own numbers.</p></div>
        <PayCalc />
        <p style={{ marginTop: 32 }}><Link className="lnk" href="/features/payments">How payments work <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <div className="head split"><h2>Not a website builder. Not an agency.</h2><p className="lede">You get a shop made properly and the tools to run it yourself, with the technical side taken off your hands.</p></div>
        <ol className="rows">
          <Reveal as="li" i={0}><span className="mono">01</span><h2>We build your store</h2><p>Designed and developed around your brand and products. No templates to choose from and nothing to assemble.</p></Reveal>
          <Reveal as="li" i={1}><span className="mono">02</span><h2>You run your business</h2><p>Add products, fulfil orders, issue refunds and manage stock from your own dashboard, on any device.</p></Reveal>
          <Reveal as="li" i={2}><span className="mono">03</span><h2>We look after the tech</h2><p>Hosting, security updates, monitoring and maintenance are included, so the shop keeps working while you sell.</p></Reveal>
        </ol>
        <p style={{ marginTop: 32 }}><Link className="lnk" href="/how-it-works">How it works, step by step <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>
    <Cta />
  </>);
}
