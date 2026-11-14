import type { Metadata } from 'next';
import { Concept } from '@/components/Concepts';
import { StartButton } from '@/components/Start';
export const metadata: Metadata = { title: 'Storefronts', description: 'Custom storefronts designed around your brand and products, connected to one calm dashboard.' };

const STEPS = [
  ['Brief', 'You tell us about your products, customers and brand. We agree the scope and a fixed price.'],
  ['Design', 'We design the storefront around your brand, with mobile first and accessibility built in from the start.'],
  ['Build', 'We build it on the Commerce engine, import your products and set up shipping, VAT and your domain.'],
  ['Launch', 'You test it. Payments, domain and checkout checks must all pass before the shop goes live.'],
];
export default function Storefronts() {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 0 }}><div className="wrap">
        <div className="hero-copy"><span className="eyebrow">Storefronts</span><h1 style={{ fontSize: 'clamp(42px,6.4vw,92px)' }}>Designed for your shop, not borrowed.</h1>
          <p className="lede">Three concept directions to show the range. Each is drawn with abstract shapes so you can judge the layout, type and mood. Your storefront will start from your own brand and photography.</p></div>
        <div className="cgrid">{(['editorial', 'bold', 'calm'] as const).map(v => <div key={v}><Concept v={v} /><div className="cap"><b style={{ textTransform: 'capitalize' }}>{v}</b><span>Concept design</span></div></div>)}</div>
      </div></section>
      <section className="sect"><div className="wrap">
        <div className="head"><span className="eyebrow">How it goes</span><h2>From brief to live shop.</h2></div>
        <div className="pillars steps4">{STEPS.map(([h, p], i) => <div key={h} className="card"><span className="num muted" style={{ fontWeight: 600 }}>0{i + 1}</span><h3 style={{ marginTop: 14 }}>{h}</h3><p>{p}</p></div>)}</div>
        <div className="acts" style={{ marginTop: 44 }}><StartButton>Join the pilot</StartButton></div>
      </div></section>
    </>
  );
}
