import { ZoneDialog } from '@/components/Dialogs';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { PostcodeCheck } from '@/components/PostcodeCheck';
import { describePrice, describeWhen } from '@/lib/delivery';
import { AlertTriangle } from 'lucide-react';
export const metadata = { title: 'Shipping and tax' };
export default async function Shipping() {
  const t = await gateway().shippingTax();
  return (<><Header title="Shipping and tax" back={{ href: '/settings', label: 'Settings' }}><ZoneDialog /></Header>
    <div className="grid">
      <div className="c-8" style={{ display: 'grid', gap: 16, }}>{t.zones.map(z => (
        <section key={z.name} className="w" aria-label={z.name}><div className="wh"><div><h2>{z.name}</h2><div className="muted" style={{ fontSize: 12.5 }}>{z.regions}</div></div><ZoneDialog zone={z} label="Edit" triggerClass="btn sm" /></div>
          <div className="rows">{z.rates.map(r => { const when = describeWhen(r.when); return (<div key={r.label} className="row"><span className="t"><b>{r.label}</b>{when && <span className="dz-when-t">Only for {when}</span>}{r.freeOverMinor && <span>Free over {money(r.freeOverMinor)}</span>}</span><span className="num">{describePrice(r)}</span></div>); })}</div></section>))}</div>
      {t.unweighed ? <p className="note c-8" role="status"><AlertTriangle size={15} aria-hidden /> {t.unweighed} of your items {t.unweighed === 1 ? 'has' : 'have'} no weight. Weight rules count them as zero, so those orders could be under-priced. Set weights on your products.</p> : null}
      <PostcodeCheck zones={t.zones} />
      <section className="w tint-blue c-4" aria-labelledby="vt"><h2 id="vt" style={{ marginBottom: 12 }}>VAT</h2>
        <dl className="kv"><dt>Prices</dt><dd>{t.pricesIncludeTax ? 'Include VAT' : 'Exclude VAT'}</dd><dt>VAT number</dt><dd>{t.vatRegistered === null ? 'Not provided' : t.vatRegistered ? 'Verified' : 'Not registered'}</dd></dl>
        <p className="muted" style={{ marginBottom: 0 }}>We never assume your VAT status. Add your VAT number to show it on receipts.</p></section>
    </div></>);
}
