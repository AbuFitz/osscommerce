import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
export function Cta({ title = 'Ready when you are.', sub = 'Tell us about your business in three short steps. A person replies.' }: { title?: string; sub?: string }) {
  return <section className="sec cta"><div className="wrap"><h2>{title}</h2><p className="lede">{sub}</p><div className="acts"><Link className="btn green" href="/start">Start your store <ArrowRight size={18} aria-hidden /></Link><Link className="btn glass" href="/contact">Talk to us</Link></div></div></section>;
}
