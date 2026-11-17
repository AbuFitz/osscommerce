import type { Metadata } from 'next';
import { Receipt } from '@/components/Receipt';
import { PageHead, Head, Price, Cta, Faq } from '@/components/Parts';
import { PRICE } from '@/config';
export const metadata: Metadata = { title: 'Pricing', description: 'One build, one monthly price, and a small fee on payments.' };
export default function Page() {
  return (<><PageHead tag="Pricing" title={<>Simple to <span className="it" style={{ color: 'var(--green)' }}>understand.</span></>} lede={`${PRICE.build} once to build your store, then ${PRICE.monthly} a month. Payments carry a 0.5% fee on top of Stripe’s cost.`} />
    <section className="sec t"><div className="wrap"><Price /></div></section>
    <section className="sec dark"><div className="wrap"><Head tag="Payments" title="What you keep, to the penny." /><Receipt dark /></div></section>
    <section className="sec"><div className="wrap"><Head tag="Questions" title="The money questions." />
      <Faq items={[['Is VAT added?', 'No. We are not VAT registered, so the prices shown are final.'], ['Is there a contract?', 'Your terms are set out in writing before anything is built.'], ['What is not included?', 'Stripe’s processing cost, which is paid on each sale, and any custom functionality beyond the standard store, which we scope and quote first.']]} /></div></section>
    <Cta /></>);
}
