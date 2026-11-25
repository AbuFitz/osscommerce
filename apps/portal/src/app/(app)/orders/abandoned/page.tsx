import Link from 'next/link';
import { Mail } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { ago, money } from '@/lib/format';
import { Header } from '@/components/ui';
import type { AbandonedCheckout } from '@/lib/gateway';
export const metadata = { title: 'Abandoned checkouts' };
export const dynamic = 'force-dynamic';

const items = (c: AbandonedCheckout) => c.lines.map(l => `${l.qty} × ${l.title}${l.variant ? ` (${l.variant})` : ''}`).join(', ');
/** A plain email the merchant can send themselves, so following up works today without any email service being set up. */
const mailto = (c: AbandonedCheckout, store: string) => `mailto:${c.email}?subject=${encodeURIComponent(`You left something behind at ${store}`)}&body=${encodeURIComponent(`Hi${c.name ? ` ${c.name.split(' ')[0]}` : ''},\n\nYou left ${items(c)} in your basket. If something put you off or you had a question, just reply and I will help.\n\nThanks,\n${store}`)}`;

export default async function Abandoned() {
  const g = gateway(); const [a, store] = await Promise.all([g.abandonedCheckouts(), g.store()]);
  return (<>
    <Header eyebrow="Orders" title="Abandoned checkouts" back={{ href: '/orders', label: 'Orders' }} />
    <p className="muted" style={{ margin: '0 0 16px', maxWidth: '62ch' }}>People who put things in their basket and gave an email, then left without paying. Anyone who has not been active for an hour appears here for 30 days.</p>
    <div className="kgrid ab-k">
      <div className="w kcard"><div className="muted">Waiting for you</div><div className="kpi">{a.items.length}</div></div>
      <div className="w kcard"><div className="muted">Left behind</div><div className="kpi">{money(a.valueMinor)}</div></div>
      <div className="w kcard"><div className="muted">Baskets with no email</div><div className="kpi">{a.anonymous}</div><small className="muted">Cannot be followed up</small></div>
    </div>
    {a.items.length === 0 ? <section className="w flat" style={{ marginTop: 16 }}><h2 style={{ marginBottom: 6 }}>Nothing left behind</h2><p className="muted" style={{ margin: 0 }}>When someone leaves with items in their basket and has given an email, you will see them here.</p></section>
      : <ul className="ab-list" style={{ marginTop: 16 }}>{a.items.map(c => (
        <li key={c.id} className="w ab-row">
          <div className="ab-who"><b>{c.name ?? c.email}</b>{c.name && <span className="muted">{c.email}</span>}<span className={`ab-pill ${c.stage}`}>{c.stage === 'checkout' ? 'Reached payment' : 'In the basket'}</span></div>
          <div className="ab-what"><span>{items(c)}</span><span className="muted">{ago(c.lastActiveAt, a.asOf)}</span></div>
          <div className="ab-act"><b className="num">{money(c.totalMinor)}</b><a className="btn sml" href={mailto(c, store.name)}><Mail size={15} aria-hidden />Email them</a></div>
        </li>))}</ul>}
    <p className="muted" style={{ margin: '18px 4px 0', fontSize: 13 }}>Automatic reminder emails are one of your <Link href="/automations" className="link">automations</Link>, and need your store email set up first. Until then, the button above opens a ready-written email you can send yourself.</p>
  </>);
}
