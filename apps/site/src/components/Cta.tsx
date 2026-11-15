import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
export function Cta({ title = 'Tell us about your shop.' }: { title?: string }) {
  return <section className="sec dark cta"><div className="wrap"><h2>{title}</h2><div className="acts"><Link className="btn green" href="/contact">Start a store <ArrowRight size={18} aria-hidden /></Link><Link className="btn line" href="/pricing">See pricing</Link></div></div></section>;
}
