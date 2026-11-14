import { Check } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
export const metadata = { title: 'Payments' };
export default async function Payments() {
  const { payments: p } = await gateway().shippingTax();
  return (<><Header title="Payments" eyebrow="Settings"><button className="btn primary" type="button">Open Stripe dashboard</button></Header>
    <div className="grid">
      <section className="w dark c-5" aria-labelledby="ac"><div className="wh"><h2 id="ac">Stripe account</h2><span className="badge ok">Enabled</span></div>
        <div className="mono" style={{ fontSize: 15 }}>{p.account}</div><p className="muted">Customers pay your Stripe account directly. OSS never holds your funds.</p>
        <dl className="kv"><dt>Payouts</dt><dd>{p.payouts}</dd><dt>OSS application fee</dt><dd className="num">{(p.applicationFeeBp / 100).toFixed(2)}% of each captured payment</dd></dl></section>
      <section className="w c-7" aria-labelledby="cap"><div className="wh"><h2 id="cap">Capabilities</h2></div>
        <ul className="check">{p.capabilities.map(c => <li key={c.label}><span className={`tick ${c.ok ? 'on' : ''}`}>{c.ok && <Check size={12} aria-hidden />}</span><div style={{ fontWeight: 550 }}>{c.label}<span className="sr">{c.ok ? ' — enabled' : ' — not enabled'}</span></div></li>)}</ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12.5 }}>If a capability is removed, checkout pauses until Stripe confirms it again.</p></section>
    </div></>);
}
