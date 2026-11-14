import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MORE_LINKS } from '@/components/nav-data';
import { Header } from '@/components/ui';
export const metadata = { title: 'More' };
import { gateway } from '@/lib/gateway-instance';
export default async function More() {
  const empty = (await gateway().orders()).length === 0;
  const links = MORE_LINKS.filter(l => !(empty && ['/analytics', '/customers', '/discounts', '/inventory'].includes(l.href)));
  return (<><Header title="More" /><div className="w" style={{ padding: 10 }}><div className="rows">{links.map(({ href, label, icon: I }) => <Link key={href} href={href} className="row" style={{ minHeight: 52 }}><span className="ic lime"><I size={18} aria-hidden /></span><span className="t"><b>{label}</b></span><ChevronRight size={16} className="muted" aria-hidden /></Link>)}</div></div></>);
}
