import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MORE_LINKS } from '@/components/nav-data';
import { Header } from '@/components/ui';
export const metadata = { title: 'More' };
export default function More() {
  return (<><Header title="More" /><div className="w tw"><ul className="list" style={{ padding: '0 16px' }}>{MORE_LINKS.map(({ href, label, icon: I }) => <li key={href}><Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44 }}><I size={18} aria-hidden /><span style={{ flex: 1 }}>{label}</span><ChevronRight size={16} aria-hidden /></Link></li>)}</ul></div></>);
}
