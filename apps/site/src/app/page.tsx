import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Browser, Phone, Shot } from '@/components/Frames';
import { StoreDemo } from '@/components/StoreDemo';
import { PlatformTabs } from '@/components/PlatformTabs';
import { PriceBlock } from '@/components/PriceBlock';
import { Mark } from '@/components/Marks';
import { Reveal } from '@/components/Reveal';
import { PRICE } from '@/config';

export default function Home() {
  return (<>
    <section className="hero">
      <div className="wrap">
        <h1>We build the store. You run the business.</h1>
        <p className="lede">A custom-built online shop, and a dashboard that makes products, orders and payments simple to manage. We look after the technology.</p>
        <div className="acts"><Link className="btn ink" href="/contact">Start a store <ArrowRight size={18} aria-hidden /></Link><Link className="btn line" href="/platform">See the platform</Link></div>
        <p className="hero-meta">{PRICE.build} to build. {PRICE.monthly} a month to run.</p>
      </div>
      <div className="wrap">
        <div className="bed">
          <div className="stage">
            <Browser className="s-store" url="kilnandthread.example"><StoreDemo /></Browser>
            <Browser className="s-dash"><Shot name="overview" alt="The OSS Commerce dashboard overview: the next order to ship, sales and order status" eager /></Browser>
            <Phone className="s-phone"><Shot name="m-order" alt="An order open on a phone, ready to mark as fulfilled" mobile eager /></Phone>
          </div>
        </div>
      </div>
    </section>

    <section className="sec dark">
      <div className="wrap">
        <div className="head"><h2>One product, three parts.</h2><p className="lede">Not a website builder, and not an agency that runs your shop for you. You get a store made for your business and the tools to run it yourself.</p></div>
        <div className="trio">
          <Reveal i={0}><span className="mono">WE BUILD</span><h3>Your storefront</h3><p>Designed and developed for your brand and products. No templates to choose from and nothing to assemble.</p></Reveal>
          <Reveal i={1}><span className="mono">YOU RUN</span><h3>Your business</h3><p>Add products, fulfil orders, issue refunds, manage stock and discounts from your own dashboard, on any device.</p></Reveal>
          <Reveal i={2}><span className="mono">WE LOOK AFTER</span><h3>The technology</h3><p>Hosting, security updates, monitoring and maintenance are included, so the shop keeps working while you sell.</p></Reveal>
        </div>
      </div>
    </section>

    <section className="sec">
      <div className="wrap duo">
        <div><h2>A shop your customers enjoy buying from.</h2><p className="lede">Every storefront is designed for the business it belongs to, and built to be fast and easy to use on a phone.</p>
          <ul className="ticks">
            <li><Check size={18} aria-hidden /><span><b>Product and collection pages</b> that show sizes, colours and stock clearly.</span></li>
            <li><Check size={18} aria-hidden /><span><b>Checkout by Stripe</b>, with cards and the wallets your Stripe account supports.</span></li>
            <li><Check size={18} aria-hidden /><span><b>Your own domain</b>, your own brand, your own customers.</span></li>
          </ul>
          <p style={{ marginTop: 28 }}><Link className="lnk" href="/storefronts">How we build storefronts <ArrowRight size={16} aria-hidden /></Link></p></div>
        <Reveal className="sell-vis">
          <Browser url="kilnandthread.example/vases/bud-vase"><StoreDemo /></Browser>
          <Phone><StoreDemo variant="phone" /></Phone>
          <div className="pay"><b>Pay £24.00</b><div className="pay-row"><Mark k="visa" /><Mark k="mastercard" /><Mark k="applepay" /><Mark k="googlepay" /></div><small>Illustration. Methods shown at checkout depend on your Stripe account.</small></div>
        </Reveal>
      </div>
    </section>

    <section className="sec bone" id="platform">
      <div className="wrap">
        <div className="head split"><h2>Everything you need to run the shop, in one place.</h2><p className="lede">The dashboard is where the day-to-day happens. It is built to be quick to learn and comfortable to use on a phone.</p></div>
        <PlatformTabs />
        <p style={{ marginTop: 36 }}><Link className="lnk" href="/platform">Tour the whole platform <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>

    <section className="sec">
      <div className="wrap">
        <div className="head"><h2>Paid directly. Delivered your way.</h2></div>
        <div className="cards2">
          <Reveal className="card pine"><h3>Payments go to your own Stripe account</h3><p>You connect a Stripe account in your name. Customers pay you, and Stripe pays out to your bank. We never hold your money.</p>
            <div className="marks"><Mark k="stripe" mono /><Mark k="visa" mono /><Mark k="mastercard" mono /><Mark k="amex" mono /><Mark k="applepay" mono /><Mark k="googlepay" mono /></div>
            <p><Link className="lnk" href="/payments">Payments and checkout <ArrowRight size={16} aria-hidden /></Link></p></Reveal>
          <Reveal className="card" i={1}><h3>Delivery zones and prices you control</h3><p>Set where you deliver and what it costs, offer free delivery over an amount, and mark orders as sent with tracking.</p>
            <div className="crop"><Shot name="shipping" alt="Delivery zones and prices in the dashboard" /></div></Reveal>
        </div>
      </div>
    </section>

    <section className="sec dark">
      <div className="wrap">
        <div className="head split"><h2>The technical side is our job.</h2><p className="lede">You should not need a developer on call to keep a shop open. The monthly fee covers the upkeep.</p></div>
        <ul className="cols">
          <li><b>Managed hosting</b><span>Your storefront and dashboard are hosted and kept running by us.</span></li>
          <li><b>Security updates</b><span>The platform is patched and maintained without you lifting a finger.</span></li>
          <li><b>Monitoring</b><span>We watch the service so problems are found and dealt with.</span></li>
          <li><b>Support from the people who built it</b><span>Technical questions go to our team, not a call centre.</span></li>
        </ul>
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
        <p style={{ marginTop: 28 }}><Link className="lnk" href="/pricing">Full pricing details <ArrowRight size={16} aria-hidden /></Link></p>
      </div>
    </section>

    <section className="sec light">
      <div className="wrap">
        <div className="head"><h2>It is your business. It stays yours.</h2></div>
        <ul className="cols">
          <li><b>You are the seller</b><span>Customers buy from you. Their orders and details belong to your business.</span></li>
          <li><b>Your domain stays in your name</b><span>We connect it to the store. It remains yours.</span></li>
          <li><b>Your money goes to you</b><span>Payments settle in your own Stripe account and pay out to your bank.</span></li>
          <li><b>You can leave with your data</b><span>If the service ends, we give you an export of your products, orders and customers.</span></li>
        </ul>
      </div>
    </section>

    <section className="sec dark cta">
      <div className="wrap"><h2>Tell us about your shop.</h2><div className="acts"><Link className="btn green" href="/contact">Start a store <ArrowRight size={18} aria-hidden /></Link><Link className="btn line" href="/pricing">See pricing</Link></div></div>
    </section>
  </>);
}
