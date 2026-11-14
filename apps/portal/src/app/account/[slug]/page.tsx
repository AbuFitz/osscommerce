import { ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/ui';
import { MANAGE_URL } from '@/lib/env';
const NAMES: Record<string, string> = { website: 'Website', billing: 'Billing', support: 'Support' };
export default async function AccountSlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const name = NAMES[slug] ?? 'Account';
  return (<><Header title={name} eyebrow="Your OSS account" />
    <div className="w" style={{ maxWidth: 560 }}>
      <p style={{ marginTop: 0 }}>{name} is managed in your OSS account. It is the same login, so you will not be asked to sign in again.</p>
      {MANAGE_URL ? <a className="btn primary" href={`${MANAGE_URL}/${slug}`}>Open {name.toLowerCase()} <ArrowUpRight size={16} aria-hidden /></a>
        : <p className="muted" style={{ margin: 0 }}>Your OSS account is not linked to this store yet. Contact support if you expected it to be.</p>}
    </div></>);
}
