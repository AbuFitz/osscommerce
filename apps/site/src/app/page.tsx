import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroScene } from '@/components/HeroScene';
import { Stage } from '@/components/Stage';
import { OrdersReel, ContentReel, CheckoutReel } from '@/components/Reels';
import { PricingTable, FeeExample } from '@/components/Pricing';
import { StartButton } from '@/components/Start';
import { WidgetStage } from '@/components/WidgetStage';
import { Reveal } from '@/components/Reveal';

const WE = ['Storefront design and build', 'Hosting, security and monitoring', 'Payment set-up with Stripe', 'Updates and platform maintenance', 'Technical support'];
const YOU = ['Products, stock and pricing', 'Orders, shipping and refunds', 'Content, pages and legal policies', 'Discounts, emails and automations', 'Your team and their access'];
const TECH = [
  ['Hosting', 'Your storefront and shop run on managed infrastructure. You never touch a server.'],
  ['Security', 'Every shop’s data is kept apart from every other shop’s, with access controls and an audit record of anything we do on your behalf.'],
  ['Monitoring', 'We watch checkout, payments and your domain, and tell you if something affects your customers.'],
  ['Backups', 'Regular backups, with restores tested before your shop launches.'],
  ['Payments', 'Stripe Connect, set up in your own Stripe account. The money goes to you.'],
  ['Updates', 'Platform improvements reach every shop without you installing a thing.'],
  ['Support', 'Defined technical support through the portal. Hours and response times are written into your order form.'],
];
const STEPS = [['Brief and quote', 'Tell us about your business, products and customers. We agree the scope and a fixed price before anything starts.'], ['Design', 'We design a storefront around your brand, phone first, and show you before we build.'], ['Build and configure', 'We build it, import your products and set up shipping, VAT, payments and your domain.'], ['Launch and hand over', 'We check payments, domain and a test order. You get a walkthrough, and the portal to run it from.']];
const TRUST = [['Your business.', 'Your domain, brand, products and customer relationships belong to you.'], ['Your money.', 'Payments connect to your own Stripe account. We never hold your customers’ money or your balance.'], ['Your data.', 'Export your products, orders and customers whenever you like.'], ['Your exit.', 'Leave on 30 days’ notice. We help move your domain, close access and delete data as the contract says.']];
const FAQ = [
  ['Are you a cheaper Shopify?', 'No, and we won’t claim to be. Shopify is a mature platform with a huge ecosystem. We offer something different: a storefront designed and built for you, a platform we run on your behalf, and a team you can talk to.'],
  ['What do I manage myself?', 'Day to day, nearly everything: products, stock, orders, shipping, discounts, content, legal pages, emails and your team. You should not need to contact us to run your shop.'],
  ['Can you do things for me?', 'Yes. Ask through the portal for product uploads, a redesigned section, new content or an extra integration. These are separate services, quoted before we start.'],
  ['How do payments work?', 'Customers pay through your own Stripe account. Express checkout such as Apple Pay, Google Pay and Link appears where the customer’s device and region support it.'],
  ['What about VAT, shipping and legal pages?', 'We set sensible defaults during onboarding and give you tools and editable templates. You are the seller, so the policies and tax decisions are yours. We provide the tools, not legal advice.'],
  ['Can I move my existing shop?', 'We can rebuild it and import your products. Migrations are quoted individually and never done without your say-so.'],
  ['What is ready now?', 'Commerce is opening to a small number of pilot shops. Some features are still being finished, and we will tell you exactly what is ready before you sign.'],
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="h1">
        <div className="hero-grid">
          <div>
            <h1 id="h1"><span>Your store.</span><span>Your brand.</span><span className="g">Built for you.</span></h1>
            <p className="lede">A bespoke online shop with everything you need to sell, manage and grow. <span className="hide-m"> Designed around your business, powered by OSS Commerce, and looked after by our technical team.</span></p>
            <div className="acts"><StartButton className="btn white">Start your store</StartButton><a className="btn ghost" href="#dashboard">See it working <ArrowRight size={16} aria-hidden /></a></div>
            <div className="hero-note"><span>Custom-built storefront</span><span>Your own Stripe account</span><span>We run the technology</span></div>
          </div>
        </div>
        <HeroScene />
        <div className="grain" aria-hidden />
      </section>

      <section className="sect light state"><div className="wrap">
        <Reveal><h2>We build the store. <em>You run the business.</em></h2></Reveal>
        <div className="state-grid">
          <p className="lede">Most platforms hand you a template and a list of plugins to assemble. We design a storefront around your brand, set up and look after the technology, then give you a dashboard that lets you run the shop yourself.</p>
          <div className="two">
            <div className="who"><h3>We look after</h3><ul>{WE.map(x => <li key={x}>{x}</li>)}</ul></div>
            <div className="who you"><h3>You run</h3><ul>{YOU.map(x => <li key={x}>{x}</li>)}</ul></div>
          </div>
        </div>
      </div></section>

      <section className="sect pine" id="showcase"><div className="wrap">
        <h2 style={{ maxWidth: '14ch' }}>Not a template. A shop that looks like you.</h2>
        <p className="lede sub" style={{ marginTop: 24, maxWidth: '46ch' }}>Five concept directions for five kinds of business. Each one starts from the brand, the products and how customers like to shop.</p>
        <Stage />
      </div></section>

      <section className="sect dark" id="dashboard"><div className="wrap">
        <h2 style={{ maxWidth: '14ch' }}>The dashboard that runs the shop.</h2>
        <p className="lede sub" style={{ marginTop: 24, maxWidth: '46ch' }}>Orders, products, content, emails and automations in one calm place. It works as well on a phone as on a desk.</p>
        <WidgetStage />
        <dl className="rules cap3">{[['Orders', 'Payment and fulfilment tracked separately, so nothing looks done when it is not.'], ['Settings', 'Switches that warn before they bite, with a save bar and no silent losses.'], ['Refunds', 'The exact amount and the consequence, confirmed once.']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div></section>

      <section className="sect pine"><div className="wrap">
        <h2 style={{ maxWidth: '12ch' }}>A day in the shop.</h2>
        <p className="lede sub" style={{ marginTop: 24, maxWidth: '44ch' }}>Two things you will do all the time, done without calling anyone.</p>
        <div className="reels two"><OrdersReel /><ContentReel /></div>
      </div></section>

      <section className="sect dark"><div className="wrap" style={{ display: 'grid', gap: 'clamp(32px,6vw,96px)', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', alignItems: 'center' }}>
        <div><h2 style={{ maxWidth: '11ch' }}>A checkout customers trust.</h2>
          <p className="lede sub" style={{ marginTop: 24 }}>One reliable checkout foundation across every storefront, in your branding. Phone first, accessible, and built to recover when things go wrong.</p>
          <ul className="who" style={{ listStyle: 'none', padding: 0, margin: '32px 0 0' }}>{['Guest checkout, with optional accounts and saved addresses', 'Express checkout where the device supports it', 'Accurate delivery, tax and discounts, recalculated on the server', 'Clear confirmation, tracking and receipts by email', 'Failed payments and stock changes handled gracefully'].map(x => <li key={x} style={{ borderColor: 'var(--line-d)' }}>{x}</li>)}</ul></div>
        <div style={{ maxWidth: 440, width: '100%', justifySelf: 'center' }}><CheckoutReel /></div>
      </div></section>

      <section className="sect bone"><div className="wrap">
        <h2 style={{ maxWidth: '14ch' }}>The technical side is our job.</h2>
        <dl className="rules" style={{ marginTop: 56 }}>{TECH.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div></section>

      <section className="sect light"><div className="wrap">
        <h2 style={{ maxWidth: '12ch' }}>From first call to live shop.</h2>
        <div className="steps">{STEPS.map(([h, p], i) => <Reveal key={h} i={i} className="step"><i>0{i + 1}</i><h3>{h}</h3><p>{p}</p></Reveal>)}</div>
      </div></section>

      <section className="sect bone" id="pricing"><div className="wrap">
        <h2 style={{ maxWidth: '14ch' }}>Clear pricing. Clearly separate.</h2>
        <p className="lede" style={{ marginTop: 24, maxWidth: '48ch' }}>A one-off fee for the storefront we build, a monthly fee for the platform we run, and a small fee on sales.</p>
        <PricingTable />
        <div className="notin">
          <div><b>Not included</b><p>Payment processing fees are charged by Stripe to your account. Your domain renewal and VAT are separate.</p></div>
          <div><b>Extra work is separate</b><p>Design changes, product uploads, content creation and additional integrations are services we quote before we start. Request them in the portal.</p></div>
        </div>
        <FeeExample />
      </div></section>

      <section className="sect dark"><div className="wrap">
        <h2 style={{ maxWidth: '16ch' }}>It is your business. We keep it that way.</h2>
        <div className="trust">{TRUST.map(([h, p], i) => <Reveal key={h} i={i}><h3>{h}</h3><p>{p}</p></Reveal>)}</div>
        <p className="sub" style={{ marginTop: 28, color: 'var(--on-dark-2)', maxWidth: '58ch' }}>Pilot shop stories will appear here once those shops are live and their owners are happy for us to share them.</p>
      </div></section>

      <section className="sect light"><div className="wrap">
        <h2 style={{ maxWidth: '12ch' }}>Questions, answered straight.</h2>
        <div className="qa">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div></section>

      <section className="light" style={{ paddingBottom: 'clamp(40px,6vw,80px)' }}><div className="wrap"><div className="cta">
        <h2>Let&rsquo;s build your store.</h2>
        <p>We&rsquo;re opening Commerce to a small number of pilot shops. Tell us about yours and we&rsquo;ll reply personally.</p>
        <div className="acts"><StartButton className="btn white">Start your store</StartButton><Link className="btn ghost" href="/pricing">See pricing</Link></div>
      </div></div></section>
    </>
  );
}
