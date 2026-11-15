import type { Metadata } from 'next';
import Link from 'next/link';
import { Cta } from '@/components/Cta';
export const metadata: Metadata = { title: 'How it works', description: 'How OneSimpleCommerce builds your store with you: brief, design, build, set-up and launch, and who does what afterwards.' };
const STEPS = [['We talk', 'You tell us about the business, the products and how you sell today. It starts with three short questions.'], ['We design', 'You see the storefront design and ask for changes. Nothing is built until you are happy with it.'], ['We build', 'We develop the store and connect it to your dashboard.'], ['We set it up', 'Payments, delivery zones and VAT settings are configured with you, and you add your products.'], ['You launch', 'We test the whole journey on phones and desktops, then go live on your domain.']] as const;
export default function How() {
  return (<>
    <section className="fh"><div className="wrap"><p className="kicker">How it works</p><h1>We do the building. You do the selling.</h1><p className="lede">OneSimpleCommerce is not a website builder and not an agency that runs your shop for you. We make the store and look after the technology. You run the business from your dashboard.</p></div></section>
    <section className="sec tight"><div className="wrap"><ol className="rows">{STEPS.map(([t, d], i) => <li key={t}><span className="mono">0{i + 1}</span><h2>{t}</h2><p>{d}</p></li>)}</ol></div></section>
    <section className="sec bone"><div className="wrap"><div className="head"><h2>Who does what.</h2></div>
      <div className="tbl">
        <div><h3>We do</h3><ul><li>Design and build the storefront</li><li>Set up payments, delivery and VAT settings with you</li><li>Host, secure, monitor and maintain the platform</li><li>Answer technical questions and fix platform faults</li></ul></div>
        <div><h3>You do</h3><ul><li>Add and price your products</li><li>Fulfil orders and handle refunds</li><li>Look after your customers</li><li>Keep your stock, policies and content up to date</li></ul></div>
        <div><h3>Yours, always</h3><ul><li>You are the seller: the customers are yours</li><li>Your domain stays in your name</li><li>Payments go to an account in your name</li><li>You can leave with an export of your data</li></ul></div>
      </div><p style={{ marginTop: 28 }}><Link className="lnk" href="/pricing">See pricing</Link></p></div></section>
    <Cta />
  </>);
}
