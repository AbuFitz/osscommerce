import { Check } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
export const metadata = { title: 'Settings' };

export default async function Settings() {
  const s = await gateway().store();
  const host = s.store.hostnames[0];
  return (<>
    <Header title="Settings" />
    <div className="grid">
      <section className="w c-7" aria-labelledby="pay">
        <div className="wh"><h2 id="pay">Payments</h2><span className={`badge ${s.store.paymentReadiness === 'enabled' ? 'ok' : 'warn'}`}>{s.store.paymentReadiness === 'enabled' ? 'Enabled' : 'Action needed'}</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Customers pay your Stripe account directly. Payouts and fees are managed in Stripe.</p>
        <button className="btn" type="button">Open Stripe dashboard</button>
      </section>
      <section className="w c-5" aria-labelledby="dom">
        <div className="wh"><h2 id="dom">Domain</h2><span className={`badge ${host.verified ? 'ok' : 'warn'}`}>{host.verified ? 'Verified' : 'Not verified'}</span></div>
        <div className="mono">{host.host}</div>
        {!host.verified && <p className="muted">Add the DNS record we show you, then check again.</p>}
        <button className="btn sm" type="button">Check domain</button>
      </section>
      <section className="w c-12" aria-labelledby="launch">
        <div className="wh"><h2 id="launch">Launch checklist</h2></div>
        <ul className="check">{s.readiness.map(r => <li key={r.gate}><span className={`tick ${r.done ? 'on' : ''}`}>{r.done && <Check size={12} aria-hidden />}</span><div><span style={{ fontWeight: 550 }}>{r.label}</span><span className="sr">{r.done ? ' — done' : ' — not done'}</span>{!r.done && <small>{r.hint}</small>}</div></li>)}</ul>
      </section>
    </div></>);
}
