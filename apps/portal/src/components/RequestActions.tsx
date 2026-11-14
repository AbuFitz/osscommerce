'use client';
import { useState } from 'react';
import { Dialog } from '@oss-commerce/ui';
import { useRun } from './Actions';
import { createServiceRequest, decideQuote } from '@/app/actions';
import { money } from '@/lib/format';
import type { ServiceRequest } from '@/lib/gateway';

const KINDS: [ServiceRequest['kind'], string][] = [['product_upload', 'Upload products for me'], ['design_change', 'Change or add to the design'], ['content', 'Write or create content'], ['integration', 'Connect another service'], ['other', 'Something else']];
export function NewRequest() {
  const [open, setOpen] = useState(false); const [kind, setKind] = useState<ServiceRequest['kind']>('product_upload'); const [title, setTitle] = useState(''); const [detail, setDetail] = useState(''); const { run, pending } = useRun();
  return (<>
    <button className="btn primary" type="button" onClick={() => setOpen(true)}>New request</button>
    <Dialog open={open} onClose={() => setOpen(false)} title="Ask us to do something" description="We reply with a fixed quote. Nothing is charged until you approve it."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" type="button" disabled={pending || title.trim().length < 4} onClick={() => run(() => createServiceRequest(kind, title, detail), () => { setOpen(false); setTitle(''); setDetail(''); })}>{pending ? 'Sending…' : 'Send request'}</button></>}>
      <div className="field"><label htmlFor="rk">What do you need?</label><select id="rk" value={kind} onChange={e => setKind(e.target.value as ServiceRequest['kind'])}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="rt">Short summary</label><input id="rt" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="field"><label htmlFor="rd">Details <span className="muted">(optional)</span></label><textarea id="rd" rows={4} value={detail} onChange={e => setDetail(e.target.value)} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--line)', font: 'inherit' }} /></div>
      <p className="note">Never include card numbers or passwords in a request.</p>
    </Dialog></>);
}
export function QuoteDecision({ r }: { r: ServiceRequest }) {
  const [open, setOpen] = useState(false); const { run, pending } = useRun();
  return (<>
    <button className="btn sm primary" type="button" onClick={() => setOpen(true)}>Review quote</button>
    <Dialog open={open} onClose={() => setOpen(false)} title={r.title} description={`Fixed quote: ${money(r.quoteMinor ?? 0)} plus VAT, billed separately from your subscription.`}
      footer={<><button className="btn" type="button" disabled={pending} onClick={() => run(() => decideQuote(r.id, false), () => setOpen(false))}>Decline</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => decideQuote(r.id, true), () => setOpen(false))}>{pending ? 'Saving…' : `Approve ${money(r.quoteMinor ?? 0)}`}</button></>}>
      <p style={{ margin: 0 }}>{r.detail}</p>
    </Dialog></>);
}
