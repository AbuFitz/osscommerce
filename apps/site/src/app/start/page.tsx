import type { Metadata } from 'next';
import { SignupFlow } from '@/components/SignupFlow';
import { WhatsApp } from '@/components/WhatsApp';
import { PRICE, SITE } from '@/config';
export const metadata: Metadata = { title: 'Start your store', description: 'Three short steps to tell us about your business. We reply personally and build your store with you.' };
export default function Start() {
  return (
    <section className="su glow"><div className="wrap su-grid">
      <div className="su-side"><p className="kicker">Start your store</p><h1>Tell us what you’re selling.</h1>
        <p className="lede">Three short steps. A person reads every one and replies, usually within one working day.</p>
        <dl className="su-price"><div><dt>{PRICE.build}</dt><dd>One-time build fee</dd></div><div><dt>{PRICE.monthly}<small>/mo</small></dt><dd>Managed commerce</dd></div></dl>
        <div className="su-contact"><WhatsApp inline /><p><a href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p></div></div>
      <SignupFlow />
    </div></section>
  );
}
