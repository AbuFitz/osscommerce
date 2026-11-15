'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { previewCollection, createCollection } from '@/app/actions';

/** Create a collection from a rule, with a live count of what it would hold before anything is saved. */
export function CreateCollection() {
  const toast = useToast(); const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [rule, setRule] = useState(''); const [pending, start] = useTransition();
  const [prev, setPrev] = useState<{ count: number; products: string[] } | null>(null); const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (!rule.trim()) { setPrev(null); return; } let live = true; const t = setTimeout(async () => { const r = await previewCollection(rule); if (live) setPrev(r); }, 250); return () => { live = false; clearTimeout(t); }; }, [rule]);
  const go = () => { const e: Record<string, string> = {}; if (!name.trim()) e.name = 'Name is required.'; if (!rule.trim()) e.rule = 'Add a word to match.'; setErr(e); if (Object.keys(e).length) return; start(async () => { const r = await createCollection(name, rule); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { setOpen(false); setName(''); setRule(''); } }); };
  return (<>
    <button className="btn primary" type="button" onClick={() => { setErr({}); setOpen(true); }}>Create collection</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Create collection" description="A collection groups products on your website, like a shelf. Products join automatically when they match the rule."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="submit" form="colf" disabled={pending} aria-busy={pending}>{pending ? 'Creating…' : 'Create collection'}</button></>}>
      <form id="colf" className="fd" noValidate onSubmit={e => { e.preventDefault(); go(); }}>
        <div className={`field${err.name ? ' bad' : ''}`}><label htmlFor="cn">Name <span className="req" aria-hidden>*</span></label><input id="cn" value={name} onChange={e => setName(e.target.value)} placeholder="Kitchen and table" aria-invalid={!!err.name} />{err.name && <p className="ferr" role="alert">{err.name}</p>}</div>
        <div className={`field${err.rule ? ' bad' : ''}`}><label htmlFor="cr">Include products whose name contains <span className="req" aria-hidden>*</span></label><input id="cr" value={rule} onChange={e => setRule(e.target.value)} placeholder="mug" aria-invalid={!!err.rule} />{err.rule && <p className="ferr" role="alert">{err.rule}</p>}</div>
        <div className="cprev" role="status" aria-live="polite">{prev === null ? <span className="muted">Type a word to see what would be included.</span> : prev.count === 0 ? <span className="muted">Nothing matches yet.</span> : <><b>{prev.count} variant{prev.count > 1 ? 's' : ''}</b> from {prev.products.join(', ')}</>}</div>
      </form></Dialog></>);
}
