import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MORE_LINKS } from '@/components/nav-data';
import { Header } from '@/components/ui';
export const metadata = { title: 'More' };
import { gateway } from '@/lib/gateway-instance';
export default async function More() {
  const empty = (await gateway().orders()).length === 0;
  const links = MORE_LINKS.filter(l => !(empty && ['/analytics', '/customers', '/discounts', '/inventory'].includes(l.href)));
  return (<><Header title="More" /><div className="glist"><section aria-label="More"><ul>{links.map(({ href, label, icon: I }) => <li key={href}><Link href={href}><span className="ic lime"><I size={18} aria-hidden /></span><span className="t"><b>{label}</b></span><ChevronRight size={18} className="chev" aria-hidden /></Link></li>)}</ul></section></div></>);
}
