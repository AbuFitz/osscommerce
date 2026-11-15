import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Shipping and tax' };
export default async function Shipping() {
  const t = await gateway().shippingTax();
  return (<><Header title="Shipping and tax" back={{ href: '/settings', label: 'Settings' }}><button className="btn primary" type="button">Add zone</button></Header>
    <div className="grid">
      <div className="c-8" style={{ display: 'grid', gap: 16, }}>{t.zones.map(z => (
        <section key={z.name} className="w" aria-label={z.name}><div className="wh"><div><h2>{z.name}</h2><div className="muted" style={{ fontSize: 12.5 }}>{z.regions}</div></div><button className="btn sm" type="button">Edit</button></div>
          <div className="rows">{z.rates.map(r => <div key={r.label} className="row"><span className="t"><b>{r.label}</b>{r.freeOverMinor && <span>Free over {money(r.freeOverMinor)}</span>}</span><span className="num">{money(r.priceMinor)}</span></div>)}</div></section>))}</div>
      <section className="w tint-blue c-4" aria-labelledby="vt"><h2 id="vt" style={{ marginBottom: 12 }}>VAT</h2>
        <dl className="kv"><dt>Prices</dt><dd>{t.pricesIncludeTax ? 'Include VAT' : 'Exclude VAT'}</dd><dt>VAT number</dt><dd>{t.vatRegistered === null ? 'Not provided' : t.vatRegistered ? 'Verified' : 'Not registered'}</dd></dl>
        <p className="muted" style={{ marginBottom: 0 }}>We never assume your VAT status. Add your VAT number to show it on receipts.</p></section>
    </div></>);
}
