import type { Metadata } from 'next';
import { Mark } from '@/components/Marks';
import { Calculator } from '@/components/Calculator';
import { Faq } from '@/components/Faq';
import { Flow } from '@/components/Flow';
import { PageHead, Closing } from '@/components/Sections';
export const metadata: Metadata = { title: 'Payments', description: 'Cards, Apple Pay and Google Pay, paid straight to your bank, with every fee shown.' };
export default function Page() {
  return (<><PageHead tag="Payments" title={<>Paid <span className="grad">to you.</span></>} lede="Customers pay by card, Apple Pay or Google Pay. Stripe pays you out to your bank. Our fee is 0.5% of each payment." />
    <section className="wrap" style={{ marginBottom: 'clamp(50px,8vw,110px)' }}><Flow tone="dk" motion="sweep" className="round"><div className="stage-dk"><p className="tag" style={{ marginBottom: 18 }}>Every fee, to the penny</p><Calculator />
      <div className="brands" style={{ color: '#d0d0d8' }} aria-label="Accepted payment methods">{(['visa', 'mastercard', 'amex', 'applepay', 'googlepay'] as const).map(k => <span key={k}><Mark k={k} mono /></span>)}</div></div></Flow></section>
    <section className="sec" style={{ paddingTop: 0 }}><div className="wrap faq-g"><h2>Plainly answered.</h2>
      <Faq items={[['Who holds the money?', 'Stripe. Payments go to your connected Stripe account and are paid out to your bank on Stripe’s schedule.'], ['What does a payment cost?', 'Stripe’s processing cost, which depends on the card used, plus our 0.5%. The calculator above shows both.'], ['What happens on a refund?', 'You refund from your dashboard. The fee we took on the refunded part is returned in proportion.'], ['What about disputes?', 'They appear in your dashboard with the evidence deadline, so nothing is missed.']]} /></div></section>
    <Closing /></>);
}
