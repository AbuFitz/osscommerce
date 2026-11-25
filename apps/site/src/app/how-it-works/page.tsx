import type { Metadata } from 'next';
import { Faq } from '@/components/Faq';
import { Timeline } from '@/components/Timeline';
import { PageHead, Closing } from '@/components/Sections';
export const metadata: Metadata = { title: 'How it works', description: 'From first call to first order.' };
const S = [['A short call', 'We learn what you sell, who buys it, and how you work.'], ['Design and scope', 'You see your store design and a written scope before anything is built or billed.'], ['Build and connect', 'We build the store, set up payments and delivery with you, and add your products.'], ['Launch', 'You get your dashboard login, a walkthrough, and we are there if you need us.']] as const;
export default function Page() {
  return (<><PageHead tone="dk" tag="How it works" title={<>From first call to <span className="grad">first order.</span></>} lede="You stay in charge of the business. We handle the build." />
    <section className="tl-wrap"><div className="wrap"><Timeline steps={S} /></div></section>
    <section className="sec" style={{ paddingTop: 0 }}><div className="wrap faq-g"><h2>Before you start.</h2>
      <Faq items={[['Do I need to be technical?', 'No. We build and connect everything, and the dashboard is made for non-technical people.'], ['Can I change things afterwards?', 'Yes. Products, prices, stock and content are yours to edit. For bigger changes, ask us.'], ['Who owns my store?', 'You own your brand, products and customer data.']]} /></div></section>
    <Closing /></>);
}
