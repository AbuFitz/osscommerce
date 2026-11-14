import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MORE_LINKS } from '@/components/nav-data';
import { Header } from '@/components/ui';
export const metadata = { title: 'More' };
export default function More() {
  return (<><Header title="More" /><div className="w" style={{ padding: 10 }}><div className="rows">{MORE_LINKS.map(({ href, label, icon: I }) => <Link key={href} href={href} className="row" style={{ minHeight: 52 }}><span className="ic lime"><I size={18} aria-hidden /></span><span className="t"><b>{label}</b></span><ChevronRight size={16} className="muted" aria-hidden /></Link>)}</div></div></>);
}
