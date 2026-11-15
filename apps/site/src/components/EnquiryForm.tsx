'use client';
import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Enquiry, errorsOf, RANGE, SELLING, type EnquiryErrors } from '@/lib/enquiry';
import { SITE } from '@/config';

type State = { s: 'idle' } | { s: 'sending' } | { s: 'done'; ref?: string } | { s: 'failed'; why: string };
const EMPTY = { name: '', email: '', phone: '', business: '', website: '', sellingNow: 'not_yet', productRange: 'unsure', message: '', company_url: '' };

export function EnquiryForm() {
  const [v, setV] = useState(EMPTY); const [err, setErr] = useState<EnquiryErrors>({}); const [st, setSt] = useState<State>({ s: 'idle' }); const top = useRef<HTMLDivElement>(null);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(p => ({ ...p, [k]: e.target.value }));
  const mailto = `mailto:${SITE.email}?subject=${encodeURIComponent('Starting a store')}&body=${encodeURIComponent(`Name: ${v.name}\nBusiness: ${v.business}\nWebsite: ${v.website}\n\n${v.message}`)}`;
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); const p = Enquiry.safeParse(v);
    if (!p.success) { const e = errorsOf(p.error); setErr(e); const first = Object.keys(e)[0]; document.getElementById(`f-${first}`)?.focus(); return; }
    setErr({}); setSt({ s: 'sending' });
    try {
      const r = await fetch('/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...v, path: location.pathname }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setSt({ s: 'done', ref: j.ref });
      else if (r.status === 422 && j.errors) { setErr(j.errors); setSt({ s: 'idle' }); }
      else setSt({ s: 'failed', why: r.status === 429 ? 'Too many attempts from this connection. Wait a few minutes, or email us.' : 'We could not save your enquiry just now. Nothing was sent.' });
    } catch { setSt({ s: 'failed', why: 'We could not reach the server. Check your connection and try again. Nothing was sent.' }); }
    top.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  if (st.s === 'done') return (<div ref={top} className="msg ok" role="status"><b>Thank you, {v.name.split(' ')[0]}. We have your enquiry.</b><br />We will reply to {v.email} personally.{st.ref ? ` Your reference is ${st.ref}.` : ''}</div>);
  const F = ({ k, label, hint, ...p }: { k: keyof EnquiryErrors; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="fld"><label htmlFor={`f-${k}`}>{label}</label><input id={`f-${k}`} value={v[k] as string} onChange={set(k)} aria-invalid={!!err[k]} aria-describedby={err[k] ? `e-${k}` : hint ? `h-${k}` : undefined} {...p} />
      {err[k] ? <small id={`e-${k}`} className="err">{err[k]}</small> : hint ? <small id={`h-${k}`}>{hint}</small> : null}</div>);
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div ref={top}>{st.s === 'failed' && <div className="msg bad" role="alert"><b>{st.why}</b><br />You can try again, or <a href={mailto}>email {SITE.email}</a> and we will pick it up from there.</div>}</div>
      <div className="row">{F({ k: 'name', label: 'Your name', autoComplete: 'name', required: true })}{F({ k: 'email', label: 'Email', type: 'email', autoComplete: 'email', inputMode: 'email', required: true })}</div>
      <div className="row">{F({ k: 'business', label: 'Business name', autoComplete: 'organization', required: true })}{F({ k: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', hint: 'Optional. Only if you prefer a call.' })}</div>
      {F({ k: 'website', label: 'Current website or social page', hint: 'Optional. It helps us see your brand before we talk.', placeholder: 'https://', inputMode: 'url' })}
      <div className="row">
        <div className="fld"><label htmlFor="f-sellingNow">Where do you sell today?</label><select id="f-sellingNow" value={v.sellingNow} onChange={set('sellingNow')}>{SELLING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="fld"><label htmlFor="f-productRange">How many products?</label><select id="f-productRange" value={v.productRange} onChange={set('productRange')}>{RANGE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div className="fld"><label htmlFor="f-message">Anything else we should know?</label><textarea id="f-message" value={v.message} onChange={set('message')} aria-describedby="h-message" /><small id="h-message">Optional. What you sell, anything the shop must do, or services you already use.</small></div>
      <div className="hp" aria-hidden><label>Leave this empty<input tabIndex={-1} autoComplete="off" value={v.company_url} onChange={set('company_url')} /></label></div>
      <div className="acts"><button className="btn ink" type="submit" disabled={st.s === 'sending'} aria-busy={st.s === 'sending'}>{st.s === 'sending' ? 'Sending…' : <>Send enquiry <ArrowRight size={18} aria-hidden /></>}</button></div>
      <small className="muted">We use these details only to reply about your store. See our <a href="/legal/privacy">privacy notice</a>.</small>
    </form>
  );
}
