import type { Metadata } from 'next';
import { Receipt } from '@/components/Receipt';
import { Mark } from '@/components/Marks';
import { PageHead, Head, Cta, Faq } from '@/components/Parts';
export const metadata: Metadata = { title: 'Payments', description: 'Cards, Apple Pay and Google Pay, paid straight to your bank, with every fee shown.' };
export default function Page() {
  return (<><PageHead tag="Payments" title={<>Paid to <span className="it" style={{ color: 'var(--green)' }}>you.</span></>} lede="Customers pay by card, Apple Pay or Google Pay. Stripe pays you out to your bank. Our fee is 0.5% of each payment." />
    <section className="sec dark"><div className="wrap"><Receipt dark />
      <div className="acts" style={{ marginTop: 40, gap: 22 }} aria-label="Accepted payment methods">{(['visa', 'mastercard', 'amex', 'applepay', 'googlepay'] as const).map(k => <span key={k} style={{ width: 40, color: '#f2eee5' }}><Mark k={k} mono /></span>)}</div></div></section>
    <section className="sec"><div className="wrap"><Head tag="Questions" title="Plainly answered." />
      <Faq items={[['Who holds the money?', 'Stripe. Payments go to your connected Stripe account and are paid out to your bank on Stripe’s schedule.'], ['What does a payment cost?', 'Stripe’s processing cost, which depends on the card used, plus our 0.5%. The calculator above shows both.'], ['What happens on a refund?', 'You refund from your dashboard. The fee we took on the refunded part is returned in proportion.'], ['What about disputes?', 'They appear in your dashboard with the evidence deadline, so nothing is missed.']]} /></div></section>
    <Cta /></>);
}
