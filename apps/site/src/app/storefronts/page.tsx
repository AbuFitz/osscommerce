import type { Metadata } from 'next';
import { StorefrontPage, CONCEPTS, type Variant } from '@/components/StorefrontPage';
import { StartButton } from '@/components/Start';
import { Display } from '@/components/Devices';
export const metadata: Metadata = { title: 'Storefronts', description: 'Concept storefronts across different industries. Every shop we build is designed around the business.' };
export default function Storefronts() {
  return (
    <>
      <section className="pine"><div className="wrap ph"><h1>Not a template. A shop that looks like you.</h1><p className="lede sub" style={{ color: 'var(--on-dark-2)' }}>Concept directions for different kinds of business. Imagery is 3D-rendered, not photography of a real shop. Your storefront starts from your brand and your products.</p></div></section>
      <section className="sect light" style={{ paddingTop: 'clamp(40px,6vw,80px)' }}><div className="wrap">
        <div className="cg">{(Object.keys(CONCEPTS) as Variant[]).map(v => (
          <figure key={v} style={{ margin: 0 }}><div style={{ padding: '0 4% 6px' }}><Display label={`${CONCEPTS[v].industry} storefront on a laptop`}><StorefrontPage v={v} /></Display></div><figcaption><b>{CONCEPTS[v].industry}</b><span>Concept design</span></figcaption></figure>))}</div>
        <div className="acts" style={{ marginTop: 56 }}><StartButton>Start your store</StartButton></div>
      </div></section>
    </>
  );
}
