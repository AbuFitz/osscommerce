import type { Metadata } from 'next';
import { Reveal } from '@/components/Reveal';
import { PageHead, Closing } from '@/components/Sections';
export const metadata: Metadata = { title: 'Custom builds', description: 'Functionality shaped around how your business actually works.' };
const R = [
  { tag: 'Local fitting or services', h: 'Offer something only where you can', p: 'Sell a product and offer fitting only where you can actually do it. The customer enters a postcode and sees the right option.', l: ['Coverage area set by you', 'Fitting slots and prices at checkout', 'Delivery everywhere else'] },
  { tag: 'Made to order', h: 'Products customers personalise', p: 'Let customers choose options and add a message. The price updates as they go and you receive a clear order to make.', l: ['Options and limits you set', 'Live price as they choose', 'Made-to-order details on every order'] },
  { tag: 'Rewarding more', h: 'Timed offers that reward buying more', p: 'Free delivery on anything added within a set window after an order, with orders packed together so you ship once.', l: ['Window length you choose', 'A visible countdown', 'Combined shipping handled for you'] },
] as const;
export default function Page() {
  return (<><PageHead tone="sweep" tag="Custom builds" title={<>Shaped around <span className="grad">how you work.</span></>} lede="Every business has something it does differently. We build that into your store instead of asking you to work around a template." />
    <section className="sec"><div className="wrap split">{R.map((r, i) => (<Reveal key={r.tag}><article><div className="sp-n" aria-hidden>0{i + 1}</div><div><p className="tag">{r.tag}</p><h3>{r.h}</h3><p>{r.p}</p><ul>{r.l.map(x => <li key={x}>{x}</li>)}</ul></div></article></Reveal>))}</div></section>
    <Closing tone="dk" line={<>Got something <span className="grad">specific in mind?</span></>} /></>);
}
