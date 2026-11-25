'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { addCustomerNoteAction, deleteCustomerNoteAction, eraseCustomerAction, exportCustomerAction, updateCustomerProfileAction } from '@/app/actions';
import { when } from '@/lib/format';
import type { CustomerNote, CustomerProfile } from '@/lib/gateway';

export function EditCustomer({ id, profile }: { id: string; profile: CustomerProfile }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [v, setV] = useState(profile); const [pending, start] = useTransition();
  const bad = !v.firstName.trim() && !v.lastName.trim();
  return (<><button type="button" className="btn" onClick={() => { setV(profile); setOpen(true); }}><Pencil size={15} aria-hidden />Edit details</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Edit customer" description="Changes are saved to this customer only. Their email is how they sign in, so it is not editable here."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending || bad} onClick={() => start(async () => { const r = await updateCustomerProfileAction(id, v); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setOpen(false); })}>{pending ? 'Saving…' : 'Save'}</button></>}>
      <div className="fd"><div className="drow"><div className="field"><label htmlFor="cf">First name</label><input id="cf" value={v.firstName} maxLength={60} onChange={e => setV({ ...v, firstName: e.target.value })} /></div><div className="field"><label htmlFor="cl">Last name</label><input id="cl" value={v.lastName} maxLength={60} onChange={e => setV({ ...v, lastName: e.target.value })} /></div></div>
        <div className="field"><label htmlFor="cp">Phone</label><input id="cp" inputMode="tel" value={v.phone} maxLength={24} onChange={e => setV({ ...v, phone: e.target.value })} placeholder="Optional" /></div></div></Dialog></>);
}

/** Private notes about a customer: preferences, promises, anything the team should know. Newest first. */
export function CustomerNotes({ id, notes }: { id: string; notes: CustomerNote[] }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [text, setText] = useState(''); const [del, setDel] = useState<CustomerNote | null>(null);
  return (<div className="cnotes">
    <form className="notef" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; start(async () => { const r = await addCustomerNoteAction(id, text); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setText(''); }); }}>
      <label htmlFor="cnote" className="sr">Add a private note</label><textarea id="cnote" rows={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Add a private note about this customer" />
      <div className="notef-row"><small className="muted">Only your team can see notes.</small><button className="btn" type="submit" disabled={pending || !text.trim()} aria-busy={pending}>{pending ? 'Adding…' : 'Add note'}</button></div></form>
    {notes.length === 0 ? <p className="muted" style={{ margin: 0 }}>No notes yet.</p> : <ul className="cnl">{notes.map(n => <li key={n.id}><p>{n.text}</p><div className="muted">{n.by ? `${n.by} · ` : ''}{when(n.at)}<button type="button" className="iconbtn" onClick={() => setDel(n)} aria-label="Delete note"><Trash2 size={14} aria-hidden /></button></div></li>)}</ul>}
    <Dialog open={!!del} onClose={() => !pending && setDel(null)} title="Delete this note?" description="This cannot be undone."
      footer={<><button className="btn" type="button" onClick={() => setDel(null)} disabled={pending}>Keep it</button><button className="btn danger" type="button" disabled={pending} onClick={() => del && start(async () => { const r = await deleteCustomerNoteAction(id, del.id); toast(r.message, r.ok ? 'ok' : 'error'); setDel(null); })}>Delete note</button></>}>{del && <p className="cnq">{del.text}</p>}</Dialog>
  </div>);
}

/** The two things a person can ask a shop for under data-protection law: a copy of what is held, and erasure. */
export function PrivacyPanel({ id, name }: { id: string; name: string }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const download = () => start(async () => { const t = await exportCustomerAction(id); if (!t) { toast('That did not go through. Nothing was changed.', 'error'); return; } const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' })); a.download = `customer-data-${id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Their data has been downloaded.', 'ok'); });
  return (<>
    <p className="muted" style={{ margin: '0 0 10px', fontSize: 13.5 }}>If they ask what you hold about them, or ask you to delete it.</p>
    <div className="acts"><button className="btn sm" type="button" onClick={download} disabled={pending} aria-busy={pending}>Download their data</button><button className="btn sm" type="button" onClick={() => setOpen(true)}>Erase personal data</button></div>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title={`Erase ${name}'s personal data?`} description="Their name, email, phone, addresses, notes and login are removed for good. Their orders stay in your sales records, with the address on each blanked. This cannot be undone."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Keep</button><button className="btn danger" type="button" disabled={pending} onClick={() => start(async () => { const r = await eraseCustomerAction(id); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setOpen(false); })}>{pending ? 'Erasing…' : 'Erase'}</button></>}><span /></Dialog>
  </>);
}
