import Link from 'next/link';
import { Check } from 'lucide-react';
import { PRICE } from '@/config';
import { Reveal } from './Reveal';
import { Flow } from './Flow';

export function PageHead({ tag, title, lede, children, tone }: { tag: string; title: React.ReactNode; lede: string; children?: React.ReactNode; tone?: 'dk' | 'lt' | 'sweep' }) {
  const Wrap = ({ children: c }: { children: React.ReactNode }) => tone ? (tone === 'sweep' ? <Flow tone="dk" motion="sweep" as="header" className="ph">{c}</Flow> : <Flow tone={tone} as="header" className="ph">{c}</Flow>) : <header className="ph">{c}</header>;
  return (<Wrap><div className="wrap"><Reveal><p className="tag">{tag}</p></Reveal><Reveal delay={0.05}><h1 className="d1" style={{ fontSize: 'clamp(40px,6.4vw,80px)' }}>{title}</h1></Reveal><Reveal delay={0.1}><p className="lede">{lede}</p></Reveal>{children && <Reveal delay={0.15}><div className="acts">{children}</div></Reveal>}</div></Wrap>);
}
export function Head({ tag, title, lede }: { tag: string; title: React.ReactNode; lede?: string }) {
  return (<Reveal className="head"><p className="tag">{tag}</p><h2 className="d2">{title}</h2>{lede && <p className="lede">{lede}</p>}</Reveal>);
}
export function Cta({ title = <>Ready to <span className="grad">start?</span></>, lede = 'Tell us about your business. We will arrange a short call and show you what your store could look like.' }: { title?: React.ReactNode; lede?: string }) {
  return (<section className="sec"><div className="wrap"><Reveal><div className="cta-b"><h2 className="d2">{title}</h2><p className="lede">{lede}</p><Link className="btn pri" href="/start">Start your store</Link></div></Reveal></div></section>);
}
/** One plan. Only what is confirmed is stated: the build price, the monthly price, the payment fee and that VAT is not added. */
export function Price() {
  return (<div className="price">
    <Reveal><section><p className="tag">What you get</p><h3 className="d2" style={{ margin: '12px 0 8px' }}>One build. One monthly price.</h3>
      <ul className="ticks">{[['Your store, designed and built', 'Bespoke to your brand, not a template.'], ['Your dashboard', 'Orders, products, stock, customers, discounts and reports.'], ['Payments set up for you', 'Cards, Apple Pay and Google Pay, paid straight to your bank.'], ['Hosting, security and updates', 'Included. Nothing to patch or renew.']].map(([b, s]) => <li key={b}><Check size={18} aria-hidden /><div><b>{b}</b><span>{s}</span></div></li>)}</ul></section></Reveal>
    <Reveal delay={0.08}><section className="dk"><p className="tag" style={{ color: '#9a9aa6' }}>Pricing</p>
      <p className="fig">{PRICE.build}<small> one-time build</small></p>
      <p className="fig" style={{ fontSize: 'clamp(36px,5vw,60px)', marginTop: 12 }}>{PRICE.monthly}<small> / month</small></p>
      <ul className="ticks"><li><Check size={18} aria-hidden /><div>0.5% on payments taken through your store<span>On top of Stripe’s processing cost.</span></div></li><li><Check size={18} aria-hidden /><div>No VAT added<span>The price you see is the price you pay.</span></div></li><li><Check size={18} aria-hidden /><div>No other commission or per-product fees</div></li></ul>
      <div style={{ marginTop: 30 }}><Link className="btn pri" href="/start" style={{ background: '#fff', color: '#09090b' }}>Start your store</Link></div></section></Reveal>
  </div>);
}

/** A closing band on a moving gradient: one huge line and one button, nothing else. */
export function Closing({ line = <>Let’s build <span className="grad">yours.</span></>, tone = 'lt' }: { line?: React.ReactNode; tone?: 'dk' | 'lt' }) {
  return (<Flow tone={tone} className="cta-f"><Reveal><h2>{line}</h2><div className="acts"><Link className="btn pri" href="/start">Start your store</Link><Link className="btn" href="/contact">Talk to us first</Link></div></Reveal></Flow>);
}
