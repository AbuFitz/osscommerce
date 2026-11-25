'use client';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Enquiry, errorsOf, RANGE, SELLING, type EnquiryErrors } from '@/lib/enquiry';
import { SITE } from '@/config';

type V = { name: string; email: string; phone: string; business: string; website: string; sellingNow: string; productRange: string; message: string; company_url: string };
const EMPTY: V = { name: '', email: '', phone: '', business: '', website: '', sellingNow: 'not_yet', productRange: 'unsure', message: '', company_url: '' };
const STEPS = [
  { t: 'About you', h: 'Let’s start with you.', fields: ['name', 'email', 'phone'] },
  { t: 'Your business', h: 'Tell us about the business.', fields: ['business', 'website', 'sellingNow'] },
  { t: 'Your products', h: 'What will you sell?', fields: ['productRange', 'message'] },
] as const;
type St = { s: 'idle' } | { s: 'sending' } | { s: 'done'; ref?: string } | { s: 'failed'; why: string };

/** Three short steps, one question group each. Each step is validated before moving on; nothing is sent until the last one. */
export function SignupFlow() {
  const [v, setV] = useState(EMPTY); const [step, setStep] = useState(0); const [err, setErr] = useState<EnquiryErrors>({}); const [st, setSt] = useState<St>({ s: 'idle' }); const card = useRef<HTMLDivElement>(null);
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(p => ({ ...p, [k]: e.target.value }));
  const pick = (k: keyof V, val: string) => setV(p => ({ ...p, [k]: val }));
  const check = (n: number) => { const p = Enquiry.safeParse(v); const all = p.success ? {} : errorsOf(p.error); const mine = Object.fromEntries(Object.entries(all).filter(([k]) => (STEPS[n].fields as readonly string[]).includes(k))); setErr(mine); const first = Object.keys(mine)[0]; if (first) document.getElementById(`f-${first}`)?.focus(); return !first; };
  const focusCard = () => setTimeout(() => card.current?.querySelector<HTMLElement>('h2')?.focus(), 30);
  const next = () => { if (check(step)) { setStep(s => s + 1); focusCard(); } };
  const send = async () => {
    if (!check(step)) return; const p = Enquiry.safeParse(v); if (!p.success) { const e = errorsOf(p.error); const bad = STEPS.findIndex(s => (s.fields as readonly string[]).some(f => f in e)); setStep(Math.max(bad, 0)); setErr(e); return; }
    setSt({ s: 'sending' });
    try {
      const r = await fetch('/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...v, path: location.pathname }) }); const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setSt({ s: 'done', ref: j.ref }); focusCard(); }
      else if (r.status === 422 && j.errors) { setErr(j.errors); setSt({ s: 'idle' }); }
      else setSt({ s: 'failed', why: r.status === 429 ? 'Too many attempts from this connection. Wait a few minutes, or message us.' : 'We could not save your details just now. Nothing was sent.' });
    } catch { setSt({ s: 'failed', why: 'We could not reach the server. Check your connection and try again. Nothing was sent.' }); }
  };
  const In = ({ k, label, hint, ...p }: { k: 'name' | 'email' | 'phone' | 'business' | 'website'; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="fld"><label htmlFor={`f-${k}`}>{label}</label><input id={`f-${k}`} value={v[k]} onChange={set(k)} aria-invalid={!!err[k]} aria-describedby={err[k] ? `e-${k}` : hint ? `h-${k}` : undefined} {...p} />
      {err[k] ? <small id={`e-${k}`} className="err">{err[k]}</small> : hint ? <small id={`h-${k}`}>{hint}</small> : null}</div>);
  const Choice = ({ k, legend, opts }: { k: 'sellingNow' | 'productRange'; legend: string; opts: readonly (readonly [string, string])[] }) => (
    <fieldset className="fld chips"><legend>{legend}</legend><div>{opts.map(([val, l]) => <label key={val} data-on={v[k] === val || undefined}><input type="radio" name={k} value={val} checked={v[k] === val} onChange={() => pick(k, val)} />{l}</label>)}</div></fieldset>);

  if (st.s === 'done') return (
    <div className="formcard" ref={card}><div className="su-done"><span className="su-tick"><Check size={26} aria-hidden /></span>
      <h2 tabIndex={-1}>Thank you, {v.name.split(' ')[0]}. That is everything we need.</h2>
      <p>We will reply to <b>{v.email}</b> personally to arrange a short call.{st.ref ? ` Your reference is ${st.ref}.` : ''}</p>
      <ol className="su-next"><li><b>A short call</b>We talk through your business, products and brand.</li><li><b>Design and quote</b>You see the storefront design and a written scope before anything is built or billed.</li><li><b>Build and launch</b>We build the store, set up payments and delivery with you, and you get your dashboard login.</li></ol></div></div>);
  return (
    <div className="formcard" ref={card}>
      <ol className="su-steps" aria-label="Progress">{STEPS.map((s, i) => <li key={s.t} data-state={i < step ? 'done' : i === step ? 'now' : 'next'} aria-current={i === step ? 'step' : undefined}><span>{i < step ? <Check size={13} aria-hidden /> : i + 1}</span>{s.t}</li>)}</ol>
      <form className="form" noValidate onSubmit={e => { e.preventDefault(); step < STEPS.length - 1 ? next() : send(); }}>
        <h2 tabIndex={-1}>{STEPS[step].h}</h2>
        {st.s === 'failed' && <div className="msg bad" role="alert"><b>{st.why}</b><br />Try again, or <a href={SITE.whatsapp.href}>message us on WhatsApp</a> or <a href={`mailto:${SITE.email}`}>email {SITE.email}</a>.</div>}
        {step === 0 && <>{In({ k: 'name', label: 'Your name', autoComplete: 'name' })}{In({ k: 'email', label: 'Email', type: 'email', autoComplete: 'email', inputMode: 'email', hint: 'We reply here, and it becomes your dashboard login.' })}{In({ k: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', hint: 'Optional. Only if you would like a call or WhatsApp.' })}</>}
        {step === 1 && <>{In({ k: 'business', label: 'Business name', autoComplete: 'organization' })}{In({ k: 'website', label: 'Website or social page', placeholder: 'https://', inputMode: 'url', hint: 'Optional. It helps us see your brand before we talk.' })}{Choice({ k: 'sellingNow', legend: 'Where do you sell today?', opts: SELLING })}</>}
        {step === 2 && <>{Choice({ k: 'productRange', legend: 'Roughly how many products?', opts: RANGE })}
          <div className="fld"><label htmlFor="f-message">What do you sell, and is there anything the shop must do?</label><textarea id="f-message" value={v.message} onChange={set('message')} aria-describedby="h-message" /><small id="h-message">Optional. A sentence or two is plenty.</small></div></>}
        <div className="hp" aria-hidden><label>Leave this empty<input tabIndex={-1} autoComplete="off" value={v.company_url} onChange={set('company_url')} /></label></div>
        <div className="su-acts">{step > 0 ? <button type="button" className="btn" onClick={() => { setErr({}); setStep(s => s - 1); focusCard(); }}><ArrowLeft size={18} aria-hidden />Back</button> : <span />}
          <button className="btn pri" type="submit" disabled={st.s === 'sending'} aria-busy={st.s === 'sending'}>{step < STEPS.length - 1 ? <>Continue <ArrowRight size={18} aria-hidden /></> : st.s === 'sending' ? 'Sending…' : <>Send to the team <ArrowRight size={18} aria-hidden /></>}</button></div>
        <small className="su-fine">Step {step + 1} of {STEPS.length}. We use these details only to reply about your store. <a href="/legal/privacy">Privacy notice</a>.</small>
      </form>
    </div>);
}
