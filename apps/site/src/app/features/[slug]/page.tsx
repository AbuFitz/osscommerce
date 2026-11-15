import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { FEATURES, feature } from '@/content/features';
import { FeatureVisual } from '@/components/FeatureVisual';
import { Orbit } from '@/components/Orbit';
import { Cta } from '@/components/Cta';
import { Showcase } from '@/components/Showcase';

export const dynamicParams = false;
export const generateStaticParams = () => FEATURES.map(f => ({ slug: f.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const f = feature((await params).slug); return f ? { title: f.nav, description: f.lede } : {}; }

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = feature((await params).slug); if (!f) notFound(); const others = FEATURES.filter(x => x.slug !== f.slug).slice(0, 3);
  return (<>
    <section className="fh"><div className="wrap">
      <p className="kicker">{f.group} · {f.nav}</p><h1>{f.h1}</h1><p className="lede">{f.lede}</p>
      <div className="acts"><Link className="btn bone" href="/start">Start your store</Link><Link className="btn glass" href="/how-it-works">How it works</Link></div>
      <div className="fh-vis">{f.slug === 'payments' ? <div className="pay-hero"><Orbit /></div> : f.slug === 'orders' ? <><Showcase /><p className="cap">A recording of the real dashboard, with demo data.</p></> : <FeatureVisual v={f.visual} />}</div>
    </div></section>
    <section className="sec"><div className="wrap"><ul className="trio3">{f.points.map(([t, d], i) => <li key={t}><span className="mono">0{i + 1}</span><h2>{t}</h2><p>{d}</p></li>)}</ul></div></section>
    {f.slug === 'payments' && <section className="sec tight"><div className="wrap"><p className="lede">Payment costs are set out in full on the <Link href="/pricing">pricing page</Link>.</p></div></section>}
    <section className="sec"><div className="wrap"><div className="head"><h2>Built into every store.</h2></div><ul className="built">{f.more.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul></div></section>
    <section className="sec tight"><div className="wrap"><p className="mono muted" style={{ marginBottom: 18 }}>Keep exploring</p><ul className="next3">{others.map(o => <li key={o.slug}><Link href={`/features/${o.slug}`}><b>{o.nav}</b><span>{o.blurb}</span><ArrowRight size={18} aria-hidden /></Link></li>)}</ul></div></section>
    <Cta />
  </>);
}
