'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { ROLE_INFO, type Member } from '@/lib/gateway';
import { changePassword, inviteMember, removeMember, setMemberRole } from '@/app/actions';

type Staff = Exclude<Member['role'], 'owner'>;
const STAFF: Staff[] = ['manager', 'fulfilment', 'analyst'];
const useOpen = () => { const [open, set] = useState(false); return { open, show: () => set(true), hide: () => set(false) }; };

/** Adds someone and hands the owner a one-time password. It is shown once here and never stored, so the dialog says so plainly. */
export function InviteStaff() {
  const d = useOpen(); const toast = useToast(); const [pending, start] = useTransition();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', role: 'fulfilment' as Staff }); const [err, setErr] = useState(''); const [secret, setSecret] = useState<{ email: string; pw: string } | null>(null); const [copied, setCopied] = useState(false);
  const reset = () => { setF({ firstName: '', lastName: '', email: '', role: 'fulfilment' }); setErr(''); setSecret(null); setCopied(false); };
  const close = () => { if (pending) return; d.hide(); setTimeout(reset, 200); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); setErr(''); start(async () => { const r = await inviteMember(f); if (!r.ok) { setErr(r.message); return; } toast(r.message, 'ok'); setSecret({ email: f.email.trim(), pw: r.secret ?? '' }); }); };
  const copy = async () => { try { await navigator.clipboard.writeText(secret!.pw); setCopied(true); } catch { /* the password is on screen to copy by hand */ } };
  return (<>
    <button className="btn primary" type="button" onClick={() => { reset(); d.show(); }}>Add team member</button>
    <Dialog open={d.open} onClose={close} title={secret ? 'Hand over their password' : 'Add a team member'}
      description={secret ? undefined : 'They sign in with their email and a one-time password you give them. They can change it straight away.'}
      footer={secret ? <button className="btn primary" type="button" onClick={close}>Done</button> : <><button className="btn" type="button" onClick={close} disabled={pending}>Cancel</button><button className="btn primary" type="submit" form="invite-form" disabled={pending} aria-busy={pending}>{pending ? 'Adding…' : 'Add'}</button></>}>
      {secret ? (<div className="hand">
        <p>Send this to <b>{secret.email}</b> by a private message. <b>It is shown only once</b>; if it is lost, remove them and add them again.</p>
        <div className="hand-pw"><code aria-label="One-time password">{secret.pw}</code><button className="btn sm" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></div>
        <p className="muted" style={{ fontSize: 12.5 }}>They sign in at the same page you do.</p></div>
      ) : (<form id="invite-form" onSubmit={submit} noValidate className="stack">
        <div className="two"><div className="field"><label htmlFor="sf">First name</label><input id="sf" autoComplete="off" required maxLength={80} value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
          <div className="field"><label htmlFor="sl">Last name</label><input id="sl" autoComplete="off" required maxLength={80} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div></div>
        <div className="field"><label htmlFor="se">Email</label><input id="se" type="email" autoComplete="off" required maxLength={200} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@example.com" /></div>
        <fieldset className="roles"><legend>What can they do?</legend>
          {STAFF.map(r => <label key={r} className={f.role === r ? 'on' : ''}><input type="radio" name="role" checked={f.role === r} onChange={() => setF({ ...f, role: r })} /><span><b>{ROLE_INFO[r].label}</b><small>{ROLE_INFO[r].blurb}</small></span></label>)}</fieldset>
        {err && <p className="err" role="alert">{err}</p>}
      </form>)}
    </Dialog>
  </>);
}

/** Change someone's role or remove them. Owners are never shown here: an owner cannot be demoted or removed by anyone but the platform. */
export function MemberActions({ id, name, role }: { id: string; name: string; role: Staff }) {
  const d = useOpen(); const del = useOpen(); const toast = useToast(); const [pending, start] = useTransition(); const [pick, setPick] = useState<Staff>(role);
  const run = (fn: () => ReturnType<typeof setMemberRole>, done: () => void) => start(async () => { const r = await fn(); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) done(); });
  return (<>
    <div className="acts"><button className="btn sm" type="button" onClick={() => { setPick(role); d.show(); }}>Role</button><button className="btn sm" type="button" onClick={del.show}>Remove</button></div>
    <Dialog open={d.open} onClose={d.hide} title={`${name}'s role`} footer={<><button className="btn" type="button" onClick={d.hide} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={pending || pick === role} onClick={() => run(() => setMemberRole(id, pick), d.hide)}>{pending ? 'Saving…' : 'Save role'}</button></>}>
      <fieldset className="roles"><legend className="sr">Role</legend>{STAFF.map(r => <label key={r} className={pick === r ? 'on' : ''}><input type="radio" name={`r-${id}`} checked={pick === r} onChange={() => setPick(r)} /><span><b>{ROLE_INFO[r].label}</b><small>{ROLE_INFO[r].blurb}</small></span></label>)}</fieldset>
    </Dialog>
    <Dialog open={del.open} onClose={del.hide} title={`Remove ${name}?`} description="They can no longer sign in. What they already did stays in the activity log."
      footer={<><button className="btn" type="button" onClick={del.hide} disabled={pending}>Keep</button><button className="btn danger" type="button" disabled={pending} onClick={() => run(() => removeMember(id), del.hide)}>{pending ? 'Removing…' : 'Remove'}</button></>}><span /></Dialog>
  </>);
}

export function ChangePassword() {
  const d = useOpen(); const toast = useToast(); const [pending, start] = useTransition(); const [v, setV] = useState({ cur: '', next: '', again: '' }); const [err, setErr] = useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (v.next !== v.again) { setErr('The two new passwords are different.'); return; } setErr(''); start(async () => { const r = await changePassword(v.cur, v.next); if (!r.ok) { setErr(r.message); return; } toast(r.message, 'ok'); d.hide(); setV({ cur: '', next: '', again: '' }); }); };
  return (<>
    <button className="btn" type="button" onClick={() => { setErr(''); d.show(); }}>Change password</button>
    <Dialog open={d.open} onClose={() => !pending && d.hide()} title="Change your password" footer={<><button className="btn" type="button" onClick={d.hide} disabled={pending}>Cancel</button><button className="btn primary" type="submit" form="pw-form" disabled={pending || !v.cur || !v.next} aria-busy={pending}>{pending ? 'Saving…' : 'Change password'}</button></>}>
      <form id="pw-form" onSubmit={submit} className="stack" noValidate>
        <div className="field"><label htmlFor="pc">Current password</label><input id="pc" type="password" autoComplete="current-password" value={v.cur} onChange={e => setV({ ...v, cur: e.target.value })} /></div>
        <div className="field"><label htmlFor="pn">New password</label><input id="pn" type="password" autoComplete="new-password" value={v.next} onChange={e => setV({ ...v, next: e.target.value })} /><small className="muted">At least 10 characters.</small></div>
        <div className="field"><label htmlFor="pa">New password again</label><input id="pa" type="password" autoComplete="new-password" value={v.again} onChange={e => setV({ ...v, again: e.target.value })} /></div>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </Dialog>
  </>);
}
