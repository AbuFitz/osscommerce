import type { Metadata } from 'next';
import { StartButton } from '@/components/Start';
import { PricingCalc } from '@/components/PricingCalc';
import { Faq } from '@/components/Faq';
import { PRICING } from '@/config';

export const metadata: Metadata = { title: 'Pricing', description: 'A fixed-price storefront build, a flat monthly fee and a small platform fee on sales. Compare with what you pay now.' };
const FAQ = [
  { q: 'What does the monthly fee include?', a: 'Hosting, the shop engine, the merchant dashboard, security updates, backups, and support during the hours in your order form.' },
  { q: 'What is not included?', a: 'Stripe\'s card processing fees (charged by Stripe), your domain renewal, VAT, and new design, content, migrations or custom integrations. Those are quoted before any work starts.' },
  { q: 'What does the storefront build cost?', a: 'It is quoted for your shop and agreed as a fixed price before work begins, like our website packages. Online shops start from a conversation, not a price list, because every storefront is designed for the business.' },
  { q: 'Is there a contract?', a: 'Managed commerce runs month to month on 30 days\' notice. The storefront build is a fixed-price project with its own terms.' },
  { q: 'Do prices include VAT?', a: 'No. Our prices are quoted excluding VAT, and the calculator can show them with VAT added.' },
];

export default function Pricing() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}><div className="wrap">
        <div className="hero-copy"><span className="eyebrow">Pricing</span><h1 style={{ fontSize: 'clamp(42px,6.4vw,92px)' }}>Simple on purpose.</h1>
          <p className="lede">A fixed-price build, a flat monthly fee, and a small fee on sales. No tiers to decode and no apps to buy to make checkout work.</p></div>
        <div className="pgrid">
          <div className="pcard dark"><span className="eyebrow" style={{ color: 'var(--olive-300)' }}>One-off</span><h3>Storefront build</h3><div className="price" style={{ fontSize: 'clamp(34px,4vw,48px)' }}>Quoted</div><p className="muted">Fixed price, agreed before we start. Custom design, build, product import and launch.</p></div>
          <div className="pcard"><span className="eyebrow">Monthly</span><h3>Managed commerce</h3><div className="price num">£{PRICING.monthlyGbp}<small> / month + VAT</small></div><p className="muted">Hosting, engine, dashboard, updates, backups and support.</p></div>
          <div className="pcard"><span className="eyebrow">On sales</span><h3>Platform fee</h3><div className="price num">{(PRICING.platformFeeBp / 100).toFixed(1)}%<small> of payments taken</small></div><p className="muted">Charged on captured payments through your shop. Stripe&rsquo;s own card fees are separate and go to Stripe.</p></div>
        </div>
        <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>Pilot pricing. Final terms are set out in your order form before you commit.</p>
      </div></section>
      <section className="sect" style={{ paddingTop: 'clamp(48px,7vw,88px)' }}><div className="wrap">
        <div className="head"><h2>Compare it with what you pay now.</h2><p className="lede" style={{ margin: 0 }}>Enter your own numbers. We do not guess what other platforms charge.</p></div>
        <PricingCalc />
      </div></section>
      <section className="sect" style={{ paddingTop: 0 }}><div className="wrap"><div className="head"><h2>Questions about pricing</h2></div><Faq items={FAQ} />
        <div className="acts" style={{ marginTop: 40 }}><StartButton>Join the pilot</StartButton></div></div></section>
    </>
  );
}
