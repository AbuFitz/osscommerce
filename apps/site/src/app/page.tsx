import Link from 'next/link';
import { ArrowRight, Bell, Check, CreditCard, LayoutTemplate, ShieldCheck, Store } from 'lucide-react';
import { BrowserFrame, PhoneFrame } from '@/components/Frames';
import { Tour } from '@/components/Tour';
import { Concept } from '@/components/Concepts';
import { Faq } from '@/components/Faq';
import { StartButton } from '@/components/Start';
import { PRICING, SITE } from '@/config';

const QS = [
  { q: 'Do you add a fee on every sale, on top of card fees?', a: `Yes, and we say so up front: a platform fee set out in your order form (${(PRICING.platformFeeBp / 100).toFixed(1)}% in the pilot), plus a flat monthly fee. Card fees are charged by Stripe to your own account, not by us.` },
  { q: 'Who holds the money?', a: 'Stripe pays you directly. Customers pay your Stripe account and we never hold your balance or your customers\' payments.' },
  { q: 'Who owns the domain, customer list and storefront?', a: 'You do. The domain and customer list are yours throughout. The storefront design and code are yours once the build is paid for, as set out in your quotation.' },
  { q: 'Can I leave and take everything with me?', a: 'Yes. You get an export of products, orders and customers, help moving your domain, and no notice-period games. Ending is 30 days\' notice.' },
  { q: 'Who do I speak to when something goes wrong?', a: 'A small UK team that built your shop. Support hours and response targets are written into your order form, so you know what to expect before you sign.' },
  { q: 'Can you move my existing Shopify or IONOS shop?', a: 'We can rebuild it and import your products. Migrations are quoted individually and never done without your say-so.' },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-copy">
            <span className="pill"><b aria-hidden />Now taking pilot shops</span>
            <h1>Online shops that <em>make sense.</em></h1>
            <p className="lede">A storefront designed and built for your business, with the shop engine behind it run for you. One monthly price, your own Stripe account and no app-store sprawl.</p>
            <div className="acts"><StartButton>Join the pilot</StartButton><Link className="btn" href="/pricing">See pricing <ArrowRight size={16} aria-hidden /></Link></div>
          </div>
          <div className="stage only-d">
            <BrowserFrame src="/showcase/overview-desk.jpg" alt="The Commerce dashboard overview showing orders, sales and order status" priority />
            <div className="float a"><span className="ic"><Check size={18} aria-hidden /></span><div><b>Payments connected</b><span>Stripe · paid out directly to you</span></div></div>
            <div className="float b"><span className="ic"><Bell size={18} aria-hidden /></span><div><b>New order · £21.15</b><span>Ready to fulfil</span></div></div>
          </div>
          <div className="stage phone only-m"><PhoneFrame src="/showcase/overview-mob.jpg" alt="The Commerce dashboard on a phone" priority /></div>
        </div>
      </section>

      <section className="sect"><div className="wrap">
        <div className="head"><span className="eyebrow">Not a template shop</span><h2>A web agency&rsquo;s way of doing online shops.</h2><p className="lede" style={{ margin: 0 }}>Most platforms hand you a theme and a pile of apps. We design your storefront around your brand, then run the engine so you can get on with selling. <a href={SITE.agencyUrl} style={{ textDecoration: 'underline' }}>OneSimpleSite</a> already builds fixed-price websites for UK businesses. Commerce is the shop side of the same promise.</p></div>
        <div className="pillars">
          <div className="card"><span className="ic mint"><LayoutTemplate size={22} aria-hidden /></span><h3>A storefront made for you</h3><p>Designed around your brand and products, not a theme with your logo dropped in. Fixed price, agreed before we start.</p></div>
          <div className="card"><span className="ic sun"><Store size={22} aria-hidden /></span><h3>A shop that runs itself</h3><p>Orders, stock, discounts, shipping and VAT on receipts in one calm dashboard, built for phones as much as desktops.</p></div>
          <div className="card"><span className="ic sky"><CreditCard size={22} aria-hidden /></span><h3>Your money, your customers</h3><p>Customers pay your own Stripe account. Your domain and customer list stay yours, and you can export everything any time.</p></div>
        </div>
      </div></section>

      <section className="sect" id="tour" style={{ background: 'linear-gradient(#fff,#eef5ef)', borderBlock: '1px solid var(--line)' }}><div className="wrap">
        <div className="head" style={{ marginBottom: 44 }}><span className="eyebrow">The platform</span><h2>Calm, clear and quick on a phone.</h2></div>
        <Tour />
      </div></section>

      <section className="sect"><div className="wrap">
        <div className="head"><span className="eyebrow">It adapts to you</span><h2>Only what you need, when you need it.</h2><p className="lede" style={{ margin: 0 }}>The dashboard changes with your shop. A brand-new store is not buried in empty charts, and a live store is not nagged with setup steps.</p></div>
        <div className="states">
          <div className="state s1"><span className="tag">A new shop</span><h3>Start with the one next step.</h3>
            <ul><li><Check size={16} aria-hidden />Add your first product</li><li className="off">Sales charts</li><li className="off">Analytics and customers</li></ul></div>
          <div className="state s2"><span className="tag">Getting ready</span><h3>A launch checklist that earns its space.</h3>
            <ul><li><Check size={16} aria-hidden />Connect payments</li><li><Check size={16} aria-hidden />Verify your domain</li><li><Check size={16} aria-hidden />Place a test order</li></ul></div>
          <div className="state s3"><span className="tag">Live</span><h3>Orders that need you come first.</h3>
            <ul><li><Check size={16} aria-hidden />Failed payments surface at the top</li><li><Check size={16} aria-hidden />Charts once there is something to chart</li><li className="off">Setup checklist</li></ul></div>
        </div>
      </div></section>

      <section className="sect" style={{ paddingTop: 0 }}><div className="wrap split">
        <div className="tour-copy"><span className="eyebrow">Popups done properly</span><h3 style={{ marginTop: 14 }}>Every action says what will happen first.</h3>
          <p>Refunds show the exact amount and what happens to fees. Risky switches ask once. On a phone, pop-ups become sheets you can reach with a thumb. If something fails, it tells you nothing changed.</p>
          <ul className="ticks"><li><ShieldCheck size={18} aria-hidden /><span>Confirm once, with the real consequence</span></li><li><ShieldCheck size={18} aria-hidden />Pending until the payment provider confirms</li><li><ShieldCheck size={18} aria-hidden />Keyboard and screen-reader friendly</li></ul></div>
        <div><div className="only-d"><BrowserFrame src="/showcase/refund-desk.jpg" alt="A refund confirmation pop-up in the dashboard" /></div><div className="only-m"><PhoneFrame src="/showcase/refund-mob.jpg" alt="The same refund confirmation as a bottom sheet on a phone" /></div></div>
      </div></section>

      <section className="sect" style={{ background: 'var(--forest)', color: '#fff' }}><div className="wrap">
        <div className="head"><span className="eyebrow" style={{ color: 'var(--olive-300)' }}>Storefronts</span><h2>Three shops, three moods. None of them a template.</h2><p className="lede" style={{ margin: 0, color: '#b9d8c8' }}>Concept layouts we might build, drawn with abstract shapes rather than product photos. Your storefront starts from your brand, your products and how your customers like to shop.</p></div>
        <div className="cgrid">
          {(['editorial', 'bold', 'calm'] as const).map(v => <div key={v}><Concept v={v} /><div className="cap"><b style={{ textTransform: 'capitalize' }}>{v}</b><span style={{ color: '#9fc4b1' }}>Concept design</span></div></div>)}
        </div>
        <div className="acts" style={{ marginTop: 40 }}><Link className="btn" href="/storefronts" style={{ color: 'var(--ink)' }}>See how we design them <ArrowRight size={16} aria-hidden /></Link></div>
      </div></section>

      <section className="sect"><div className="wrap">
        <div className="head"><span className="eyebrow">Straight answers</span><h2>Questions worth asking any shop platform.</h2></div>
        <div className="qtable">{QS.map(x => <div key={x.q} className="qrow"><b>{x.q}</b><p>{x.a}</p></div>)}</div>
      </div></section>

      <section><div className="wrap"><div className="cta">
        <span className="eyebrow" style={{ color: 'var(--olive-300)' }}>Pilot</span>
        <h2>Let&rsquo;s build your shop properly.</h2>
        <p>We are opening Commerce to a small number of pilot shops. Tell us about yours and we will reply personally.</p>
        <div className="acts"><StartButton>Join the pilot</StartButton><Link className="btn" href="/pricing" style={{ color: 'var(--ink)' }}>See pricing</Link></div>
      </div></div></section>
    </>
  );
}
