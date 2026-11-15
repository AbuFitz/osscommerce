import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FEATURES } from '@/content/features';
import { Showcase } from '@/components/Showcase';
import { Cta } from '@/components/Cta';
export const metadata: Metadata = { title: 'Platform', description: 'Everything in OneSimpleCommerce: the storefront we build for you and the dashboard you run it from.' };
export default function Platform() {
  return (<>
    <section className="fh"><div className="wrap"><p className="kicker">The platform</p><h1>One place to sell, and one place to run it.</h1><p className="lede">A storefront made for your brand, and a dashboard for everything behind it. It works as well on a phone as it does at a desk.</p>
      <div className="fh-vis"><Showcase /><p className="cap">A recording of the real dashboard, with demo data.</p></div></div></section>
    {(['Sell', 'Manage'] as const).map(g => <section className="sec tight" key={g}><div className="wrap"><div className="head"><h2>{g}</h2></div>
      <ul className="index">{FEATURES.filter(f => f.group === g).map((f, i) => <li key={f.slug}><Link href={`/features/${f.slug}`}><span className="mono">0{i + 1}</span><b>{f.nav}</b><span>{f.blurb}</span><ArrowRight size={20} aria-hidden /></Link></li>)}</ul></div></section>)}
    <section className="sec"><div className="wrap"><div className="head"><h2>Also in the dashboard.</h2></div><ul className="built"><li><b>Discounts</b><span>Percentage, fixed-amount and free-delivery codes with limits and end dates.</span></li><li><b>Customers</b><span>Who has ordered, how often and how much.</span></li><li><b>Team and roles</b><span>Invite people and choose what each can do.</span></li><li><b>Notifications</b><span>Failed payments, waiting orders and low stock in one place.</span></li><li><b>Search</b><span>Find any order, product or customer from anywhere.</span></li><li><b>Help and requests</b><span>Ask for design changes or support from inside the dashboard.</span></li></ul></div></section>
    <Cta />
  </>);
}
