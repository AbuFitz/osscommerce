import { Percent, Truck, PoundSterling } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Discounts' };
const tone = { active: 'ok', scheduled: 'info', expired: '' } as const;
const label = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired' } as const;

export default async function Discounts() {
  const ds = await gateway().discounts();
  const what = (d: (typeof ds)[number]) => d.kind === 'percent' ? `${d.value}% off` : d.kind === 'fixed' ? `${money(d.value)} off` : 'Free shipping';
  return (<>
    <Header title="Discounts" eyebrow={`${ds.filter(d => d.status === 'active').length} active`}><button className="btn primary" type="button">Create discount</button></Header>
    <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{ds.map(d => { const Ic = d.kind === 'percent' ? Percent : d.kind === 'fixed' ? PoundSterling : Truck; return (
      <article key={d.code} className={`w ${d.status === 'active' ? '' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className={`ic ${d.status === 'active' ? 'lime' : d.status === 'scheduled' ? 'blue' : 'peach'}`}><Ic size={18} aria-hidden /></span><span className={`badge ${tone[d.status]}`}>{label[d.status]}</span></div>
        <div className="mono" style={{ fontSize: 15, marginTop: 16, letterSpacing: '.04em' }}>{d.code}</div>
        <div className="kpi" style={{ marginTop: 6, fontSize: 26 }}>{what(d)}</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>{d.window}{d.minSpendMinor ? ` · min spend ${money(d.minSpendMinor)}` : ''}</div>
        <div style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span className="muted">Used</span><span className="num">{d.used}{d.limit ? ` of ${d.limit}` : ''}</span></div>
          {d.limit && <div className="meter" role="progressbar" aria-valuenow={d.used} aria-valuemin={0} aria-valuemax={d.limit} aria-label={`${d.code} usage`}><i style={{ width: `${Math.min(100, (d.used / d.limit) * 100)}%` }} /></div>}</div>
      </article>); })}</div></>);
}
