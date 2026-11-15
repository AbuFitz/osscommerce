import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { siResend } from 'simple-icons';
import { Mark } from '@/components/Marks';
import { Cta } from '@/components/Cta';
export const metadata: Metadata = { title: 'Integrations', description: 'OSS Commerce connects your store to Stripe for payments, with order emails and UK address checks built in.' };

/** Only integrations that are part of the launch product are listed. Research-stage providers are not advertised (see packages/integrations/src/catalogue.ts). */
export default function Integrations() {
  return (<>
    <section className="phd"><div className="wrap"><h1>Connected to the services a shop depends on.</h1><p className="lede">Payments, order emails and address checks are part of the platform. You do not install plug-ins or manage API keys.</p></div></section>
    <section className="sec tight"><div className="wrap">
      <div className="ix">
        <article className="ix-main"><div className="ix-logo"><Mark k="stripe" /></div><h2>Stripe</h2><p>Payments run through a Stripe account in your own name. Customers pay by card or a supported wallet, and Stripe pays out to your bank.</p>
          <div className="marks"><Mark k="visa" /><Mark k="mastercard" /><Mark k="amex" /><Mark k="applepay" /><Mark k="googlepay" /></div>
          <p><Link className="lnk" href="/payments">How payments work <ArrowRight size={16} aria-hidden /></Link></p></article>
        <article><div className="ix-logo"><svg className="mk" viewBox="0 0 24 24" fill="#0e1311" role="img" aria-label="Resend"><path d={siResend.path} /></svg></div><h2>Order emails</h2><p>Order confirmations, dispatch notices and refund emails are sent to your customers in your brand, delivered through Resend.</p></article>
        <article><div className="ix-logo"><MapPin size={30} aria-hidden /></div><h2>UK postcodes</h2><p>Postcodes are checked at checkout using Postcodes.io, and your delivery zones decide the price for each area.</p></article>
      </div>
      <p className="lede" style={{ marginTop: 40 }}>Use a courier, a fulfilment service or another tool you would like connected? <Link href="/contact">Tell us what you use</Link> and we will say what is possible.</p>
    </div></section>
    <Cta title="Tell us what your shop needs." />
  </>);
}
