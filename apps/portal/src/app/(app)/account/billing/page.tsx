import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { BillingPortalAction } from '@/components/BillingPortalAction';
export const metadata = { title: 'Plan and billing' };
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const ST = { paid: ['Paid', 'ok'], due: ['Due', 'warn'], overdue: ['Overdue', 'bad'] } as const;

/** The merchant's own subscription to OneSimpleCommerce. Separate from customer payments, which go to the merchant's Stripe account (Settings, Payments). */
export default async function Billing() {
  await gate('/account/billing');
  const b = await gateway().billing();
  return (<>
    <Header title="Plan and billing" back={{ href: '/settings', label: 'Settings' }}>{!b.demo && b.status !== 'not_started' && <BillingPortalAction />}</Header>
    <div className="grid">
      <section className="w dark c-5" aria-labelledby="pl"><div className="wh"><h2 id="pl">{b.planName}</h2><span className={`badge ${b.status === 'active' ? 'ok' : 'warn'}`}>{b.status === 'active' ? 'Active' : b.status === 'past_due' ? 'Payment overdue' : 'Not started'}</span></div>
        <div className="kpi">{money(b.monthlyMinor)}<span className="muted" style={{ fontSize: 15, marginLeft: 8 }}>a month</span></div>
        <p className="muted" style={{ marginBottom: 0 }}>{b.nextInvoiceAt ? `Next invoice on ${day(b.nextInvoiceAt)}.` : 'Your first invoice is raised when your store goes live.'}</p></section>
      <section className="w c-7" aria-labelledby="inc"><h2 id="inc" style={{ marginBottom: 12 }}>What your plan covers</h2>
        <ul className="check">{['The OneSimpleCommerce dashboard and storefront hosting', 'Security updates, monitoring and maintenance', 'Technical support from the OneSimpleCommerce team'].map(x => <li key={x}><span className="tick on" aria-hidden>✓</span><div><span>{x}</span></div></li>)}</ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>Money your customers pay goes to your own Stripe account and is not part of this bill. See Settings, Payments.</p></section>
      <section className="w c-12" aria-labelledby="inv"><div className="wh"><h2 id="inv">Invoices</h2></div>
        {b.invoices.length === 0 ? <div className="empty">No invoices yet. They appear here as soon as one is raised.</div>
          : <div className="rows">{b.invoices.map(i => <div key={i.number} className="row"><span className="t"><b>{i.description}</b><span>{i.number} · {day(i.issuedAt)}{i.url && <> · <a href={i.url} target="_blank" rel="noreferrer">View invoice</a></>}</span></span><span className={`badge ${ST[i.status][1]}`}>{ST[i.status][0]}</span><span className="num">{money(i.amountMinor)}</span></div>)}</div>}
        {b.demo && <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Demo figures. Real invoices come from the OneSimpleCommerce billing account once it is connected.</p>}</section>
    </div></>);
}
