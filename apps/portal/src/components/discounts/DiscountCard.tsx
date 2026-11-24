'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Gift, Pause, Pencil, Percent, Play, PoundSterling, Trash2, Truck, Zap } from 'lucide-react';
import { deleteDiscountAction, setDiscountEnabledAction } from '@/app/actions';
import { DiscountForm } from './DiscountForm';
import { describeDiscount } from '@/lib/discounts';
import { money } from '@/lib/format';
import type { Discount } from '@/lib/gateway';

const tone = { active: 'ok', scheduled: 'info', paused: 'warn', expired: '' } as const; const label = { active: 'Active', scheduled: 'Scheduled', paused: 'Paused', expired: 'Ended' } as const;
const what = (d: Discount) => (d.kind === 'percent' ? `${d.value}% off` : d.kind === 'fixed' ? `${money(d.value)} off` : d.kind === 'shipping' ? 'Free delivery' : d.kind === 'bogo' ? `Buy ${d.buy}, get ${d.get} free` : 'Custom discount');

export function DiscountCard({ d, today, productNames }: { d: Discount; today: string; productNames: string[] }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false);
  const Ic = d.kind === 'percent' ? Percent : d.kind === 'fixed' ? PoundSterling : d.kind === 'shipping' ? Truck : d.kind === 'bogo' ? Gift : Zap; const editable = d.kind !== 'custom' && !!d.id;
  const toggle = () => start(async () => { const r = await setDiscountEnabledAction(d.id!, d.status === 'paused'); toast(r.message, r.ok ? 'ok' : 'error'); });
  const sentence = d.kind === 'custom' ? 'Set up by us for your store. You can pause or delete it here; ask us to change how it works.' : describeDiscount({ method: d.automatic ? 'automatic' : 'code', code: d.code, kind: d.kind, value: d.value, minSpendMinor: d.minSpendMinor, buy: d.buy, get: d.get, limit: d.limit, perCustomer: d.perCustomer, startDate: d.startsAt?.slice(0, 10), endDate: d.endsAt?.slice(0, 10), productNames: productNames.length ? productNames : undefined });
  return (<article className={`w dcard${d.status === 'paused' || d.status === 'expired' ? ' off' : ''}`}>
    <div className="dc-top"><span className={`ic ${d.status === 'active' ? 'lime' : d.status === 'scheduled' ? 'blue' : 'peach'}`}><Ic size={18} aria-hidden /></span><span className={`badge ${tone[d.status]}`}>{label[d.status]}</span></div>
    <div className="dc-name">{d.automatic ? <span className="badge">Automatic</span> : <span className="mono">{d.code}</span>}<span className="muted">{d.name}</span></div>
    <div className="kpi" style={{ marginTop: 6, fontSize: 26 }}>{what(d)}</div>
    <p className="dc-sum">{sentence}</p>
    <div style={{ marginTop: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span className="muted">Used</span><span className="num">{d.used}{d.limit ? ` of ${d.limit}` : ''}</span></div>
      {d.limit ? <div className="meter" role="progressbar" aria-valuenow={d.used} aria-valuemin={0} aria-valuemax={d.limit} aria-label={`${d.name ?? d.code} usage`}><i style={{ width: `${Math.min(100, (d.used / d.limit) * 100)}%` }} /></div> : null}</div>
    <div className="dc-acts">
      {editable && <button type="button" className="btn sm" onClick={() => setEdit(true)}><Pencil size={14} aria-hidden />Edit</button>}
      {d.id && d.status !== 'expired' && <button type="button" className="btn sm" onClick={toggle} disabled={pending}>{d.status === 'paused' ? <><Play size={14} aria-hidden />Resume</> : <><Pause size={14} aria-hidden />Pause</>}</button>}
      {d.id && <button type="button" className="btn sm ghost" onClick={() => setDel(true)} aria-label={`Delete ${d.name ?? d.code}`}><Trash2 size={14} aria-hidden /></button>}
    </div>
    {editable && <DiscountForm open={edit} onClose={() => setEdit(false)} discount={d} today={today} />}
    <Dialog open={del} onClose={() => !pending && setDel(false)} title={`Delete ${d.name ?? d.code}?`} description={d.used > 0 ? `It has been used ${d.used} time${d.used > 1 ? 's' : ''}. Those orders keep what they were charged.` : 'This cannot be undone.'}
      footer={<><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep it</button><button className="btn danger" type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteDiscountAction(d.id!); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setDel(false); })}>Delete discount</button></>}>
      <p className="muted">Customers who still have the code will not be able to use it.{d.status === 'active' ? ' You can pause it instead to keep it for later.' : ''}</p></Dialog>
  </article>);
}
