import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Browser, Phone } from '@/components/Frames';
import { StoreDemo } from '@/components/StoreDemo';
import { Cta } from '@/components/Cta';
import { PRICE } from '@/config';
export const metadata: Metadata = { title: 'Storefronts', description: 'Every OneSimpleCommerce storefront is designed and built for one business. No templates to pick from.' };

export default function Storefronts() {
  return (<>
    <section className="phd"><div className="wrap"><h1>Built for your shop, not picked from a list.</h1><p className="lede">We design and develop each storefront for the business it belongs to. You do not choose a theme and you do not build pages. You tell us about your brand and products, and we make the shop.</p>
      <div className="acts"><Link className="btn ink" href="/start">Start your store <ArrowRight size={18} aria-hidden /></Link></div></div></section>
    <section className="sec tight"><div className="wrap">
      <div className="sell-vis" style={{ maxWidth: 1040, margin: '0 auto' }}><Browser url="kilnandthread.example/vases/bud-vase"><StoreDemo /></Browser><Phone><StoreDemo variant="phone" /></Phone></div>
      <p className="tabnote" style={{ textAlign: 'center', marginTop: 20 }}>Kiln &amp; Thread is our demonstration shop, not a client. Your storefront is designed from scratch around your own brand.</p>
    </div></section>
    <section className="sec bone"><div className="wrap">
      <div className="head"><h2>What goes into a storefront.</h2></div>
      <ul className="cols">
        <li><b>Design around your brand</b><span>Your logo, colours, photography and tone, shaped into a shop that looks like you.</span></li>
        <li><b>Made for phones first</b><span>Most shoppers arrive on a phone. Pages are designed and tested there, then on larger screens.</span></li>
        <li><b>Product pages that sell</b><span>Clear photos, options, price and stock, with an add-to-bag button that is always easy to reach.</span></li>
        <li><b>Collections and navigation</b><span>Products grouped the way your customers look for them.</span></li>
        <li><b>Basket and checkout</b><span>A short route from basket to payment, with payment handled by Stripe.</span></li>
        <li><b>Policy pages</b><span>Privacy, terms, delivery and returns pages that you can edit from the dashboard.</span></li>
      </ul>
    </div></section>
    <section className="sec"><div className="wrap">
      <div className="head split"><h2>How the build works.</h2><p className="lede">The {PRICE.build} build fee covers an agreed scope, written into your quote before we start.</p></div>
      <ol className="steps">
        <li><b>Brief</b><span>We learn about the business, products and customers.</span></li>
        <li><b>Design</b><span>You review the storefront design and ask for changes.</span></li>
        <li><b>Build</b><span>We develop the store and connect it to your dashboard.</span></li>
        <li><b>Set-up</b><span>Payments, delivery zones and VAT settings are configured with you.</span></li>
        <li><b>Launch</b><span>We test the whole journey and go live on your domain.</span></li>
      </ol>
      <p className="note" style={{ marginTop: 36 }}>After launch you can request design changes from the dashboard. Small fixes are part of support; new design work is quoted before anything is built or billed.</p>
    </div></section>
    <Cta title="Let's talk about your storefront." />
  </>);
}
