'use client';
import { useState, useTransition } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Brand } from './Brand';
import { createServiceRequest } from '@/app/actions';

export interface Card { id: string; name: string; brand: string; category: string; summary: string; availability: 'research' | 'planned' | 'building' | 'available'; payer: 'merchant' | 'oss' | 'none'; costNote: string; docsUrl: string; regions: string[]; notes?: string; missing: string[] }
const STATUS = { available: ['Available', 'ok'], building: ['Being built', 'info'], planned: ['Planned', 'info'], research: ['Researching', ''] } as const;
const WHO = { merchant: 'You pay the provider', oss: 'Included in your plan', none: 'Free to use' } as const;

/** A provider as the merchant sees it. Honest about status: nothing that is not proven is offered as connectable. */
export function IntegrationCard({ c }: { c: Card }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [asked, setAsked] = useState(false); const [label, tone] = STATUS[c.availability];
  return (<>
    <button type="button" className="w icard" onClick={() => setOpen(true)} aria-label={`${c.name}, ${label}`}>
      <Brand name={c.brand} label={c.name} size={40} />
      <span className="icard-t"><b>{c.name}</b><span>{c.summary}</span></span>
      <span className="icard-f"><span className={`badge ${tone}`}>{label}</span><span className="muted">{WHO[c.payer]}</span></span>
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} title={c.name} description={c.summary}
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)}>Close</button>
        {c.availability === 'available' ? <button className="btn primary" type="button" disabled>Connect</button>
          : <button className="btn primary" type="button" disabled={pending || asked} onClick={() => start(async () => { const r = await createServiceRequest('integration', `Integration: ${c.name}`, `I would like ${c.name} connected to my store.`); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { setAsked(true); setOpen(false); } })}>{asked ? 'Requested' : pending ? 'Sending…' : 'Ask us to prioritise this'}</button>}</>}>
      <div className="idetail"><div className="idh"><Brand name={c.brand} label={c.name} size={48} title /><div><span className={`badge ${tone}`}>{label}</span><div className="muted">{c.category} · {c.regions.join(', ')}</div></div></div>
        <dl className="kv"><dt>Cost</dt><dd>{WHO[c.payer]}</dd></dl><p className="muted" style={{ margin: 0 }}>{c.costNote}</p>
        {c.availability !== 'available' && <div className="why"><b>Why it is not connectable yet</b><ul>{c.missing.slice(0, 5).map(m => <li key={m}>{m}</li>)}</ul><p className="muted">We only switch a provider on after the integration is proven with the provider&apos;s own test environment, in the regions we sell to, with security and failure handling tested.</p></div>}
        {c.notes && <p className="muted" style={{ margin: 0 }}>{c.notes}</p>}
        <a className="link" href={c.docsUrl} target="_blank" rel="noreferrer">Provider documentation <ExternalLink size={12} aria-hidden /></a></div>
    </Dialog></>);
}
