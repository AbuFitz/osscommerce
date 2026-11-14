import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { day } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Legal pages' };
const st = { published: ['Published', 'ok'], draft: ['Draft', 'warn'], not_set_up: ['Not set up', ''] } as const;
export default async function Legal() {
  const ps = await gateway().legalPages(); const missing = ps.filter(p => p.status !== 'published').length;
  return (<><Header title="Legal pages" eyebrow="Settings" />
    {missing > 0 && <div className="w flat" style={{ marginBottom: 16 }}>{missing} page{missing > 1 ? 's' : ''} still to publish. These are needed before you launch.</div>}
    <div className="w" style={{ padding: 10 }}><div className="rows">{ps.map(p => (
      <Link key={p.slug} href={`/settings/legal/${p.slug}`} className="row" style={{ minHeight: 60 }}><span className="t"><b>{p.title}</b><span>{p.updatedAt ? `Updated ${day(p.updatedAt)}` : 'Start from a guided template'}</span></span><span className={`badge ${st[p.status][1]}`}>{st[p.status][0]}</span><ChevronRight size={16} className="muted" aria-hidden /></Link>))}</div></div>
    <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>We provide editing tools and templates. We do not provide legal advice, and generated text may not suit every business.</p></>);
}
