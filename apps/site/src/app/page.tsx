import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Browser, Phone, Shot } from '@/components/Frames';
import { StoreDemo } from '@/components/StoreDemo';
import { PlatformTabs } from '@/components/PlatformTabs';
import { PriceBlock } from '@/components/PriceBlock';
import { Scene } from '@/components/Scene';
import { Orbit } from '@/components/Orbit';
import { Reveal } from '@/components/Reveal';
import { Cta } from '@/components/Cta';
import { PRICE } from '@/config';

export default function Home() {
  return (<>
    <section className="hero glow">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker">A product by OneSimpleSite</p>
          <h1>We build the store. <em>You run the business.</em></h1>
          <p className="lede">A bespoke online store, a powerful commerce platform, and a team that takes care of the technology.</p>
          <div className="acts"><Link className="btn green" href="/start">Start your store <ArrowRight size={18} aria-hidden /></Link><Link className="btn glass" href="/platform">See the platform</Link></div>
          <dl className="hero-stats"><div><dt className="fig">{PRICE.build}</dt><dd>One-time build fee</dd></div><div><dt className="fig">{PRICE.monthly}<small>/mo</small></dt><dd>Managed commerce</dd></div></dl>
        </div>
        <Scene />
      </div>
    </section>

    <section className="sec bone">
      <div className="wrap">
        <p className="kicker dark-k">How it works</p>
        <ol className="rows">
          <Reveal as="li" i={0}><span className="mono">01</span><h2>We build your store</h2><p>Designed and developed around your brand and products. No templates to choose from and nothing to assemble.</p></Reveal>
          <Reveal as="li" i={1}><span className="mono">02</span><h2>You run your business</h2><p>Add products, fulfil orders, issue refunds and manage stock from your own dashboard, on any device.</p></Reveal>
          <Reveal as="li" i={2}><span className="mono">03</span><h2>We look after the tech</h2><p>Hosting, security updates, monitoring and maintenance are included, so the shop keeps working while you sell.</p></Reveal>
        </ol>
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <div className="panel grad-green">
          <span className="brk tl" aria-hidden /><span className="brk tr" aria-hidden /><span className="brk bl" aria-hidden /><span className="brk br" aria-hidden />
          <div className="panel-copy"><h2>A shop your customers enjoy buying from.</h2><p className="lede">Every storefront is designed for the business it belongs to, and built to be fast and easy to use on a phone.</p>
            <ul className="ticks">
              <li><Check size={18} aria-hidden /><span><b>Product and collection pages</b> that show options, price and stock clearly.</span></li>
              <li><Check size={18} aria-hidden /><span><b>Checkout built in</b>, with cards and wallets.</span></li>
              <li><Check size={18} aria-hidden /><span><b>Your own domain</b>, your own brand, your own customers.</span></li>
            </ul>
            <p style={{ marginTop: 28 }}><Link className="lnk" href="/storefronts">How we build storefronts <ArrowRight size={16} aria-hidden /></Link></p></div>
          <Reveal className="panel-vis"><Browser url="kilnandthread.example/vases/bud-vase"><StoreDemo /></Browser><Phone><StoreDemo variant="phone" /></Phone></Reveal>
        </div>
      </div>
    </section>

    <section className="sec bone" id="platform">
      <div className="wrap">
        <div className="head split"><h2>Everything you need to run the shop, in one place.</h2><p className="lede">The dashboard is where the day-to-day happens. It is quick to learn and comfortable to use on a phone.</p></div>
        <PlatformTabs />
        <p style={{ marginTop: 36 }}><Link className="lnk" href="/platform">Tour the whole platform <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>

    <section className="sec dark glow">
      <div className="wrap duo">
        <div><h2>Payments, built in.</h2><p className="lede">Take cards and wallets from day one. See every payment, what it cost and what you received, then follow the payout to your bank.</p>
          <dl className="pay-stat"><div><dt className="fig">2% + 20p</dt><dd>per standard UK card payment, all in</dd></div></dl>
          <ul className="ticks"><li><Check size={18} aria-hidden /><span>The money is yours: it is paid into an account in your name and on to your bank.</span></li><li><Check size={18} aria-hidden /><span>Refunds from the dashboard in a couple of taps.</span></li><li><Check size={18} aria-hidden /><span>Processing by Stripe.</span></li></ul>
          <p style={{ marginTop: 28 }}><Link className="lnk" href="/payments">How payments work <ArrowRight size={16} aria-hidden /></Link></p></div>
        <Reveal><Orbit /></Reveal>
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <div className="head"><h2>From first call to first order.</h2></div>
        <ol className="steps">
          <li><b>We talk</b><span>You tell us about the business, the products and how you sell today.</span></li>
          <li><b>We design</b><span>You see the storefront design and agree it before we build.</span></li>
          <li><b>We build</b><span>We develop the store and set up payments, delivery and VAT settings with you.</span></li>
          <li><b>We test</b><span>You add products and we check the full journey on phones and desktops.</span></li>
          <li><b>You launch</b><span>The store goes live on your domain and you take it from there.</span></li>
        </ol>
      </div>
    </section>

    <section className="sec bone">
      <div className="wrap">
        <div className="head split"><h2>A store of your own, built for you.</h2><p className="lede">{PRICE.build} pays for the design and build, once. {PRICE.monthly} a month keeps it hosted, maintained and supported. One plan, nothing to compare.</p></div>
        <PriceBlock />
        <p style={{ marginTop: 28 }}><Link className="lnk" href="/pricing">Full pricing and payment costs <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>

    <section className="sec light">
      <div className="wrap">
        <div className="head"><h2>It is your business. It stays yours.</h2></div>
        <ul className="cols">
          <li><b>You are the seller</b><span>Customers buy from you. Their orders and details belong to your business.</span></li>
          <li><b>Your domain stays in your name</b><span>We connect it to the store. It remains yours.</span></li>
          <li><b>Your money goes to you</b><span>Payments settle in an account in your name and pay out to your bank.</span></li>
          <li><b>You can leave with your data</b><span>If the service ends, we give you an export of your products, orders and customers.</span></li>
        </ul>
      </div>
    </section>
    <Cta />
  </>);
}
