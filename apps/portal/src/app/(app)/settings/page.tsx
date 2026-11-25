import Link from 'next/link';
import { CreditCard, Truck, Users, Store, Receipt, SlidersHorizontal, Mail, Scale, ArrowUpRight, ChevronRight, Plug } from 'lucide-react';
import { Header } from '@/components/ui';
import { gateway } from '@/lib/gateway-instance';
import { canSee } from '@/lib/access';
export const metadata = { title: 'Settings' };
const items = [
  { href: '/settings/payments', t: 'Payments', d: 'Stripe account, payouts and fees', i: CreditCard, c: 'lime' },
  { href: '/settings/shipping', t: 'Shipping and tax', d: 'Zones, rates and VAT', i: Truck, c: 'blue' },
  { href: '/settings/preferences', t: 'Preferences', d: 'Alerts, checkout and pausing orders', i: SlidersHorizontal, c: 'blue' },
  { href: '/settings/emails', t: 'Emails', d: 'Templates, branding and notifications', i: Mail, c: 'lilac' },
  { href: '/settings/legal', t: 'Legal pages', d: 'Privacy, terms, shipping and returns', i: Scale, c: 'peach' },
  { href: '/settings/integrations', t: 'Integrations', d: 'Shipping, search, maps and more', i: Plug, c: 'blue' },
  { href: '/settings/team', t: 'Team and access', d: 'Members, roles and support access', i: Users, c: 'lilac' },
  { href: '/settings/activity', t: 'Activity', d: 'What your team has changed, and when', i: Users, c: 'blue' },
  { href: '/storefront', t: 'Storefront', d: 'Theme, domain and versions', i: Store, c: 'peach' },
  { href: '/account/billing', t: 'Plan and billing', d: 'Your subscription and invoices', i: Receipt, c: 'lime' },
];
const groups = [
  { h: 'Store', rows: ['/settings/payments', '/settings/shipping', '/settings/integrations', '/settings/preferences', '/settings/emails', '/settings/legal'] },
  { h: 'People and plan', rows: ['/settings/team', '/settings/activity', '/storefront', '/account/billing'] },
];
export default async function Settings() {
  const me = await gateway().viewer(); const by = (h: string) => items.find(x => x.href === h)!;
  return (<><Header title="Settings" eyebrow="Kiln & Thread" />
    <div className="glist glist-2">{groups.filter(g => g.rows.some(h => canSee(me.kind, h))).map(g => <section key={g.h} aria-label={g.h}><h2>{g.h}</h2><ul>{g.rows.filter(h => canSee(me.kind, h)).map(h => { const x = by(h); return <li key={h}><Link href={h}><span className={`ic ${x.c}`}><x.i size={18} aria-hidden /></span><span className="t"><b>{x.t}</b><span>{x.d}</span></span><ChevronRight size={18} className="chev" aria-hidden /></Link></li>; })}</ul></section>)}</div>
  </>);
}
