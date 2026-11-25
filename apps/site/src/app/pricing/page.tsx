import type { Metadata } from 'next';
import { Calculator } from '@/components/Calculator';
import { Faq } from '@/components/Faq';
import { PageHead, Closing, Price } from '@/components/Sections';
import { PRICE } from '@/config';
export const metadata: Metadata = { title: 'Pricing', description: 'One build, one monthly price, and a small fee on payments.' };
export default function Page() {
  return (<><PageHead tone="sweep" tag="Pricing" title={<>Simple to <span className="grad">understand.</span></>} lede={`${PRICE.build} once to build your store, then ${PRICE.monthly} a month. Payments carry a 0.5% fee on top of Stripe’s cost. No VAT is added.`} />
    <section className="sec"><div className="wrap"><Price /></div></section>
    <section className="sec alt"><div className="wrap"><p className="tag" style={{ marginBottom: 22 }}>What you keep from a payment</p><Calculator /></div></section>
    <section className="sec"><div className="wrap faq-g"><h2>The money questions.</h2>
      <Faq items={[['Is VAT added?', 'No. We are not VAT registered, so the prices shown are final.'], ['Is there a contract?', 'Your terms are set out in writing before anything is built.'], ['What is not included?', 'Stripe’s processing cost, which is paid on each payment and shown in the calculator above.']]} /></div></section>
    <Closing tone="dk" /></>);
}
