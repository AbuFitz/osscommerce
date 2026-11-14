import Link from 'next/link';
import { CreditCard, Truck, Users, Store, Receipt, SlidersHorizontal, Mail, Scale, ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/ui';
export const metadata = { title: 'Settings' };
const items = [
  { href: '/settings/payments', t: 'Payments', d: 'Stripe account, payouts and fees', i: CreditCard, c: 'lime' },
  { href: '/settings/shipping', t: 'Shipping and tax', d: 'Zones, rates and VAT', i: Truck, c: 'blue' },
  { href: '/settings/preferences', t: 'Preferences', d: 'Alerts, checkout and pausing orders', i: SlidersHorizontal, c: 'blue' },
  { href: '/settings/emails', t: 'Emails', d: 'Templates, branding and notifications', i: Mail, c: 'lilac' },
  { href: '/settings/legal', t: 'Legal pages', d: 'Privacy, terms, shipping and returns', i: Scale, c: 'peach' },
  { href: '/settings/team', t: 'Team and access', d: 'Members, roles and support access', i: Users, c: 'lilac' },
  { href: '/storefront', t: 'Storefront', d: 'Theme, domain and versions', i: Store, c: 'peach' },
  { href: '/account/billing', t: 'Plan and billing', d: 'Managed in your OSS account', i: Receipt, c: 'lime' },
];
export default function Settings() {
  return (<><Header title="Settings" eyebrow="Kiln & Thread" />
    <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>{items.map(x => (
      <Link key={x.href} href={x.href} className="w kcard"><div className="top2"><span className={`ic ${x.c}`}><x.i size={18} aria-hidden /></span><ArrowUpRight size={16} className="muted" aria-hidden /></div><div style={{ fontWeight: 600, fontSize: 17, marginTop: 18 }}>{x.t}</div><div className="muted" style={{ marginTop: 4 }}>{x.d}</div></Link>))}</div></>);
}
