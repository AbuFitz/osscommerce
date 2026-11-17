import Link from 'next/link';
import { Check } from 'lucide-react';
import { PRICE } from '@/config';

export function Head({ tag, title, lede, split = false }: { tag: string; title: React.ReactNode; lede?: React.ReactNode; split?: boolean }) {
  return (<div className={`head${split ? ' s' : ''}`}><p className="tag">{tag}</p><h2 className="d2">{title}</h2>{lede && <p className="lede">{lede}</p>}</div>);
}
export function PageHead({ tag, title, lede, children }: { tag: string; title: React.ReactNode; lede: React.ReactNode; children?: React.ReactNode }) {
  return (<header className="fh"><div className="wrap"><p className="tag">{tag}</p><h1 className="d1" style={{ marginTop: 18 }}>{title}</h1><p className="lede">{lede}</p>{children && <div className="acts">{children}</div>}</div></header>);
}
export function Cta({ title, lede }: { title?: React.ReactNode; lede?: string }) {
  return (<section className="cta dark"><div className="wrap"><h2 className="d2">{title ?? <>Your business is unique. <span className="it">Your store should be too.</span></>}</h2><p className="lede">{lede ?? 'Tell us what you sell. We will design the store around it and get you selling.'}</p><div className="acts"><Link className="btn go" href="/start">Start your store</Link><Link className="btn ln" href="/pricing">See pricing</Link></div></div></section>);
}
export function Price() {
  return (<div className="pb">
    <section className="a"><p className="mono">What you pay us</p><h3 className="d3">One build. One monthly price.</h3>
      <ul>{[['Your store, designed and built', 'Bespoke to your brand, not a template.'], ['Your dashboard', 'Orders, products, customers, payments and growth.'], ['Payments set up for you', 'Cards, Apple Pay and Google Pay, paid straight to your bank.'], ['Hosting, security and updates', 'Included. Nothing to patch or renew.'], ['A real person to talk to', 'Message us and we answer.']].map(([b, s]) => <li key={b}><Check size={18} aria-hidden /><div><b>{b}</b><span>{s}</span></div></li>)}</ul></section>
    <section className="b"><p className="mono" style={{ opacity: .6 }}>Pricing</p>
      <div><p className="fig">{PRICE.build}</p><p style={{ opacity: .7, marginTop: 6 }}>one-time build</p></div>
      <div><p className="fig" style={{ fontSize: 'clamp(40px,5vw,64px)' }}>{PRICE.monthly}<span style={{ fontSize: '.35em', opacity: .6, letterSpacing: 0 }}> / month</span></p></div>
      <ul><li><Check size={18} aria-hidden />0.5% on payments taken through your store, on top of Stripe&rsquo;s processing cost</li><li><Check size={18} aria-hidden />No VAT added. The price you see is the price you pay</li><li><Check size={18} aria-hidden />No commission on sales beyond that, no per-product fees</li></ul>
      <div className="foot"><Link className="btn go" href="/start">Start your store</Link></div></section>
  </div>);
}
export function Faq({ items }: { items: readonly (readonly [string, string])[] }) {
  return (<div className="faq">{items.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden>+</span></summary><p style={{ padding: '0 0 24px', color: 'var(--ink2)', maxWidth: '62ch' }}>{a}</p></details>)}</div>);
}
