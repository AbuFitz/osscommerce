import type { Metadata } from 'next';
import { FittingDemo, PersonaliseDemo, WindowDemo } from '@/components/CustomDemos';
import { PageHead, Cta } from '@/components/Parts';
export const metadata: Metadata = { title: 'Custom builds', description: 'Functionality shaped around how your business actually works.' };
const R = [
  { tag: 'Automotive', h: 'Fitting offered by postcode', p: 'Sell a part and offer fitting only where you can actually do it. The customer enters a postcode and sees the right option.', l: ['Coverage area set by you', 'Fitting slots and prices at checkout', 'Delivery everywhere else'], D: FittingDemo },
  { tag: 'Candles and gifts', h: 'Products made to order', p: 'Let customers choose scents, sizes and a message. The price updates as they go and you receive a clear order to make.', l: ['Options and limits you set', 'Live price as they choose', 'Made-to-order details on every order'], D: PersonaliseDemo },
  { tag: 'Collectibles', h: 'Timed offers that reward buying more', p: 'Free delivery on anything added within a set window after an order, with orders packed together so you ship once.', l: ['Window length you choose', 'A visible countdown', 'Combined shipping handled for you'], D: WindowDemo },
];
export default function Page() {
  return (<><PageHead tag="Custom builds" title={<>Shaped around <span className="it" style={{ color: 'var(--green)' }}>how you work.</span></>} lede="Every business has something it does differently. We build that into your store instead of asking you to work around a template." />
    <section className="sec t"><div className="wrap">{R.map(r => <div className="cb" key={r.tag}><div><p className="tag">{r.tag}</p><h3>{r.h}</h3><p>{r.p}</p><ul>{r.l.map(x => <li key={x}>{x}</li>)}</ul></div><r.D /></div>)}</div></section>
    <Cta title={<>Got something <span className="it">specific in mind?</span></>} lede="Describe how your business works and we will tell you how we would build it." /></>);
}
