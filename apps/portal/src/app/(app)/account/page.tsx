import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { account } from '@/components/nav-data';
import { Header } from '@/components/ui';
import { MANAGE_URL } from '@/lib/env';
export const metadata = { title: 'Your OSS account' };
export default function Account() {
  return (<><Header title="Your OSS account" eyebrow="One login for your website and store" />
    <div className="glist" style={{ maxWidth: 560 }}><section aria-label="Account"><ul>{account.map(({ href, label, icon: I }) => <li key={href}><Link href={href}><span className="ic lime"><I size={18} aria-hidden /></span><span className="t"><b>{label}</b></span><ChevronRight size={18} className="chev" aria-hidden /></Link></li>)}</ul></section></div>
    {!MANAGE_URL && <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Your OSS account is not linked to this store yet. Contact support if you expected it to be.</p>}</>);
}
