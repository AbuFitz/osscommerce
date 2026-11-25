import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money, when, day } from '@/lib/format';
import { Header, Avatar, PayBadge, FulBadge } from '@/components/ui';
import { CustomerNotes, EditCustomer, PrivacyPanel } from '@/components/customers/CustomerPanels';
import { daysSince } from '@/lib/customers';
export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const [c, s] = await Promise.all([gateway().customer(id), gateway().summary()]); if (!c) notFound(); const now = new Date(s.asOf); const ago = daysSince(c.lastOrder, now);
  return (<>
    <Header title={c.name} back={{ href: '/customers', label: 'Customers' }}><a className="btn" href={`mailto:${c.email}`}><Mail size={15} aria-hidden />Email</a><EditCustomer id={c.id} profile={{ firstName: c.firstName, lastName: c.lastName, phone: c.phone }} /></Header>
    <div className="kgrid" style={{ marginBottom: 16 }}>
      {[['Orders', String(c.orders)], ['Total spent', money(c.spentMinor)], ['Average order', money(c.aovMinor)], ['Last order', c.lastOrder ? (ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`) : '—']].map(([l, v], i) => <div key={l} className={`w kcard ${i === 1 ? 'dark' : ''}`}><div className="muted">{l}</div><div className="kpi">{v}</div></div>)}
    </div>
    <div className="grid">
      <section className="w c-8" aria-labelledby="co"><h2 id="co" style={{ marginBottom: 12 }}>Orders</h2>
        {c.recentOrders.length === 0 ? <p className="muted">No orders yet.</p> : <div className="rows">{c.recentOrders.map(o => (
          <Link key={o.id} href={`/orders/${o.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit' }}><span className="t"><b>#{o.number}</b><span className="muted">{when(o.placedAt)} · {o.items}</span></span><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><PayBadge s={o.payment} /><FulBadge s={o.fulfilment} state="open" /></span><span className="num">{money(o.totalMinor)}</span></Link>))}</div>}
      </section>
      <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="w" aria-labelledby="cd"><h2 id="cd" style={{ marginBottom: 12 }}>Contact</h2>
          <div className="row"><Avatar name={c.name} /><span className="t"><b>{c.name}</b><span>{c.email}</span></span></div>
          {c.phone && <p className="cphone"><Phone size={14} aria-hidden /><a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></p>}
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>Customer since {day(c.since)}</p>
          {c.addresses.length > 0 && <><h3 className="cah">Addresses</h3>{c.addresses.map(a => <p key={a} className="muted" style={{ margin: '0 0 6px', fontSize: 13.5 }}>{a}</p>)}</>}</section>
        <section className="w" aria-labelledby="cn"><h2 id="cn" style={{ marginBottom: 12 }}>Notes</h2><CustomerNotes id={c.id} notes={c.notes} /></section>
        <section className="w" aria-labelledby="cpv"><h2 id="cpv" style={{ marginBottom: 12 }}>Privacy</h2><PrivacyPanel id={c.id} name={c.name} /></section>
      </aside>
    </div></>);
}
