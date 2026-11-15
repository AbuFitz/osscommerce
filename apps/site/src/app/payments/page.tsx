import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Browser, Shot } from '@/components/Frames';
import { Mark } from '@/components/Marks';
import { Cta } from '@/components/Cta';
export const metadata: Metadata = { title: 'Payments and checkout', description: 'Customers pay into your own Stripe account. How onboarding, checkout, refunds and payouts work with OSS Commerce.' };

export default function Payments() {
  return (<>
    <section className="phd"><div className="wrap"><h1>Your customers pay you, not us.</h1><p className="lede">Payments run through a Stripe account in your business's name. Money goes from your customer to your Stripe balance and on to your bank. OSS Commerce never holds it.</p>
      <div className="marks" style={{ marginTop: 28 }}><Mark k="stripe" /><Mark k="visa" /><Mark k="mastercard" /><Mark k="amex" /><Mark k="applepay" /><Mark k="googlepay" /></div></div></section>
    <section className="sec tight"><div className="wrap">
      <article className="feature"><div><span className="mono muted">SETTING UP</span><h2>Connect once, with Stripe.</h2><p>You enter your business, identity and bank details on Stripe's own secure pages. We never see or store them. The dashboard shows where you are and what Stripe still needs.</p></div>
        <Browser><Shot name="payments" alt="Payment settings in the dashboard, showing the Stripe account status" /></Browser></article>
      <article className="feature"><div><span className="mono muted">CHECKOUT</span><h2>A checkout customers already trust.</h2><p>Card details are entered into Stripe's payment form. Cards are supported, and wallets such as Apple Pay and Google Pay appear when your Stripe account, your domain and the shopper's device support them.</p></div>
        <Browser><Shot name="order" alt="An order showing a card payment made to the merchant's Stripe account" /></Browser></article>
    </div></section>
    <section className="sec bone"><div className="wrap">
      <div className="head"><h2>The parts people ask about.</h2></div>
      <ul className="cols">
        <li><b>Refunds</b><span>Refund all or part of an order from the dashboard. The refund goes back to the customer's original payment method.</span></li>
        <li><b>Payouts</b><span>Stripe pays out to your bank on the schedule set on your Stripe account.</span></li>
        <li><b>Fees</b><span>Stripe's processing fees are charged to your Stripe account. Any platform fee is written in your order form.</span></li>
        <li><b>Disputes</b><span>Chargebacks are handled between you and Stripe, as the seller. We help with the order records you need.</span></li>
      </ul>
      <p style={{ marginTop: 24 }}><Link className="lnk" href="/integrations">See integrations <ArrowRight size={16} aria-hidden /></Link></p>
    </div></section>
    <Cta />
  </>);
}
