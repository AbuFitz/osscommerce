import type { Metadata } from 'next';
import { StoreShowcase } from '@/components/StoreShowcase';
import { PageHead, Head, Cta } from '@/components/Parts';
export const metadata: Metadata = { title: 'Bespoke stores', description: 'Online stores designed around your brand and your products, never a template.' };
const P = [['Designed around your brand', 'Your colours, type, photography and tone, carried through every page.'], ['Built for how people shop', 'Fast on a phone, clear to browse, simple to check out.'], ['Yours to change', 'Edit products, prices and content from your dashboard whenever you like.'], ['Found by search', 'Clean structure, quick pages and proper product data from day one.']] as const;
export default function Page() {
  return (<><PageHead tag="Bespoke stores" title={<>Never a <span className="it" style={{ color: 'var(--green)' }}>template.</span></>} lede="Each store is designed for one business. These four are different on purpose." />
    <section className="sec t"><div className="wrap"><StoreShowcase /></div></section>
    <section className="sec"><div className="wrap"><Head tag="What you get" title="A store that feels like yours." /><ul className="cols">{P.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}</ul></div></section>
    <Cta /></>);
}
