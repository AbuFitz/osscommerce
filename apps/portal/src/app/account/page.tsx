import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { account } from '@/components/nav-data';
import { Header } from '@/components/ui';
export const metadata = { title: 'Your OSS account' };
export default function Account() {
  return (<><Header title="Your OSS account" eyebrow="One login for your website and store" />
    <div className="w" style={{ padding: 10, maxWidth: 560 }}><div className="rows">{account.map(({ href, label, icon: I }) => <Link key={href} href={href} className="row" style={{ minHeight: 52 }}><span className="ic lime"><I size={18} aria-hidden /></span><span className="t"><b>{label}</b></span><ChevronRight size={16} className="muted" aria-hidden /></Link>)}</div></div>
    <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Integration point: OSS Manage. Not connected in this build.</p></>);
}
