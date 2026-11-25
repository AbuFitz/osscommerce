import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { HeroStage } from '@/components/HeroStage';
import { Reveal } from '@/components/Reveal';
import { Faq } from '@/components/Faq';
import { Flow } from '@/components/Flow';
import { Marquee } from '@/components/Marquee';
import { Statement } from '@/components/Statement';
import { LiveSection } from '@/components/LiveSection';
import { Timeline } from '@/components/Timeline';
import { Closing } from '@/components/Sections';
import { PRICE } from '@/config';

const STEPS = [['A short call', 'We learn what you sell, who buys it, and how you work.'], ['Design and scope', 'You see your store design and a written scope before anything is built or billed.'], ['Build and connect', 'We build the store, set up payments and delivery with you, and add your products.'], ['Launch', 'You get your dashboard login, a walkthrough, and we are there if you need us.']] as const;
export default function Home() {
  return (<>
    {/* 1. Hero: light, with the live dashboard */}
    <section className="hero"><div className="wrap">
      <Reveal><span className="eyebrow"><i />Bespoke online stores, one simple platform</span></Reveal>
      <Reveal delay={0.06}><h1 className="d1">Your store, built for you.<br /><span className="grad">Run from one place.</span></h1></Reveal>
      <Reveal delay={0.12}><p className="lede">We design and build an online store around your brand, then give you a dashboard that makes running it simple. We take care of the technology. You run the business.</p></Reveal>
      <Reveal delay={0.18}><div className="acts" style={{ justifyContent: 'center' }}><Link className="btn pri" href="/start">Start your store <ArrowRight size={16} aria-hidden /></Link><Link className="btn" href="/pricing">See pricing</Link></div></Reveal>
    </div><HeroStage /></section>

    {/* 2. One sentence on a moving black-and-white gradient. No title. */}
    <Flow tone="dk" className="statement"><div className="wrap"><Statement text="You run the business. We take care of everything that keeps it online." /></div></Flow>

    {/* 3. A thin line of words */}
    <Marquee items={['Orders', 'Stock', 'Discounts', 'Customers', 'Live map', 'Reports', 'Refunds', 'Delivery', 'Apple Pay', 'Google Pay', 'Photos from your phone']} />

    {/* 4. Copy that holds still while panels of different heights pass */}
    <section className="sec"><div className="wrap sticky-g">
      <div className="sticky-l"><Reveal><h2>A dashboard that runs the day.</h2></Reveal><Reveal delay={0.08}><p className="lede">Open it on your phone between jobs or at your desk. The same dashboard, arranged for whichever screen you have.</p></Reveal><Reveal delay={0.14}><div><Link className="btn" href="/platform">Explore the platform <ArrowRight size={16} aria-hidden /></Link></div></Reveal></div>
      <div className="panels">
        <Reveal className="pn tall"><h3>Fulfil in a couple of taps</h3><p>See what needs sending, add tracking, mark it sent. Customers are told automatically.</p>
          <div className="mini"><div className="mrow"><b>#1042</b><span className="muted">Bath</span><span className="pill a">To fulfil</span><em>£21.15</em></div><div className="mrow"><b>#1041</b><span className="muted">Leeds</span><span className="pill i">Part shipped</span><em>£68.00</em></div><div className="mrow"><b>#1040</b><span className="muted">Dublin</span><span className="pill t">Fulfilled</span><em>£126.00</em></div></div></Reveal>
        <Reveal className="pn row2"><div><h3>Stock</h3><p>A warning before you run out.</p><div className="mrow" style={{ marginTop: 'auto' }}><span>Linen apron</span><span className="pill a">Low · 4</span></div></div><div className="g"><h3>Discounts</h3><p>Codes and offers, on or off in a tap.</p><div className="mrow" style={{ marginTop: 'auto' }}><span>WELCOME10</span><span className="pill t">Active</span></div></div></Reveal>
        <Reveal className="pn dk tall"><h3>Sales you can read at a glance</h3><p>Net sales after refunds, best sellers and busy days, without a spreadsheet.</p><div className="bars" aria-hidden>{[34, 52, 40, 66, 48, 78, 92, 70, 84].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></Reveal>
        <Reveal className="pn short"><h3>Customers, remembered</h3><p>Who bought, what, and how often, with private notes.</p></Reveal>
      </div>
    </div><p className="muted" style={{ margin: '28px auto 0', width: 'min(1180px,calc(100% - 40px))', fontSize: 13 }}>Names and figures in these illustrations are sample data.</p></section>

    {/* 5. A tall, dark moment: the live map */}
    <Flow tone="dk" className="live-f"><LiveSection /></Flow>

    {/* 6. Four steps on a line that draws itself */}
    <section className="tl-wrap"><div className="wrap">
      <div className="tl-head"><h2>From first call to first order.</h2><Link className="btn sml" href="/how-it-works">The detail <ArrowRight size={14} aria-hidden /></Link></div>
      <Timeline steps={STEPS} /></div></section>

    {/* 7. The price, as big as it deserves to be. No heading. */}
    <section className="wrap" style={{ marginBottom: 'clamp(60px,9vw,130px)' }}><Reveal><Flow tone="dk" motion="sweep" className="round"><div className="pband">
      <div><p className="pn1">{PRICE.build}<small> to build</small></p><p className="pn2">then {PRICE.monthly}<small> a month</small></p></div>
      <ul className="ticks"><li><Check size={18} aria-hidden /><div>0.5% on payments taken through your store<span>On top of Stripe’s processing cost.</span></div></li><li><Check size={18} aria-hidden /><div>No VAT added<span>The price you see is the price you pay.</span></div></li><li><Check size={18} aria-hidden /><div>Hosting, security and updates included</div></li>
        <li><Link className="btn" href="/pricing" style={{ background: '#fff', color: '#09090b' }}>See what is included <ArrowRight size={16} aria-hidden /></Link></li></ul></div></Flow></Reveal></section>

    {/* 8. Questions beside a short heading */}
    <section className="sec" style={{ paddingTop: 0 }}><div className="wrap faq-g"><h2>Before you start.</h2>
      <Faq items={[['Do I need to be technical?', 'No. We build and connect everything, and the dashboard is made for non-technical people.'], ['Can I change things afterwards?', 'Yes. Products, prices, stock and content are yours to edit. For bigger changes, ask us.'], ['Who owns my store?', 'You own your brand, products and customer data.'], ['Is VAT added?', 'No. We are not VAT registered, so the prices shown are final.']]} /></div></section>

    {/* 9. A huge closing line on a light moving gradient */}
    <Closing />
  </>);
}
