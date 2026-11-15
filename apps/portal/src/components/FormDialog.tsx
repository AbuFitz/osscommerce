'use client';
import { useId, useRef, useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import type { MutationResult } from '@/lib/gateway';

/** One pattern for every "do something" dialog, so each behaves the same way:
 *  opens from a labelled button; validates on submit and says exactly which field is wrong; Enter submits; the button shows progress and cannot be pressed twice;
 *  the outcome comes back as a toast that says what actually changed; Esc, the close button and a click outside all cancel without saving. */
type Cond = { showIf?: (v: Values) => boolean };
export type Field = (
  | { name: string; label: string; type: 'text' | 'email' | 'textarea'; required?: boolean; placeholder?: string; hint?: string; max?: number; value?: string }
  | { name: string; label: string; type: 'money' | 'number'; required?: boolean; min?: number; max?: number; hint?: string; placeholder?: string; value?: string }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean; hint?: string; value?: string }
  | { name: string; label: string; type: 'segmented'; options: { value: string; label: string }[]; value: string; hint?: string }
  | { name: string; label: string; type: 'date'; hint?: string; value?: string }) & Cond;
export type Values = Record<string, string>;

export function validate(fields: Field[], v: Values): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf(v)) continue;
    const x = (v[f.name] ?? '').trim();
    if (!x) { if ('required' in f && f.required) e[f.name] = `${f.label} is required.`; continue; }
    if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) e[f.name] = 'Enter a valid email address.';
    if (f.type === 'money') { if (!/^\d+(\.\d{1,2})?$/.test(x)) e[f.name] = 'Enter an amount like 12.50.'; else if (f.min !== undefined && Number(x) < f.min) e[f.name] = `Must be at least ${f.min}.`; }
    if (f.type === 'number') { if (!/^-?\d+$/.test(x)) e[f.name] = 'Enter a whole number.'; else { const n = Number(x); if (f.min !== undefined && n < f.min) e[f.name] = `Must be at least ${f.min}.`; if (f.max !== undefined && n > f.max) e[f.name] = `Must be at most ${f.max}.`; } }
    if ((f.type === 'text' || f.type === 'textarea') && f.max && x.length > f.max) e[f.name] = `Keep it under ${f.max} characters.`;
  }
  return e;
}

export function FormDialog({ trigger, triggerClass = 'btn', title, description, fields, submit, onSubmit, children, footerNote, onDone }: {
  trigger: React.ReactNode; triggerClass?: string; title: string; description?: string; fields: Field[]; submit: string;
  onSubmit: (v: Values) => Promise<MutationResult>; children?: React.ReactNode; footerNote?: React.ReactNode; onDone?: () => void;
}) {
  const id = useId(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition();
  const init = () => Object.fromEntries(fields.map(f => [f.name, ('value' in f && f.value) || '']));
  const [v, setV] = useState<Values>(init); const [err, setErr] = useState<Record<string, string>>({}); const form = useRef<HTMLFormElement>(null);
  const close = () => { if (pending) return; setOpen(false); };
  const show = () => { setV(init()); setErr({}); setOpen(true); };
  const go = () => {
    const e = validate(fields, v); setErr(e);
    const bad = Object.keys(e)[0]; if (bad) { form.current?.querySelector<HTMLElement>(`[name="${bad}"]`)?.focus(); return; }
    start(async () => { const r = await onSubmit(v); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { setOpen(false); onDone?.(); } });
  };
  return (<>
    <button className={triggerClass} type="button" onClick={show}>{trigger}</button>
    <Dialog open={open} onClose={close} title={title} description={description}
      footer={<><button className="btn" type="button" onClick={close} disabled={pending}>Cancel</button><button className="btn primary" type="submit" form={`${id}-f`} disabled={pending} aria-busy={pending}>{pending ? 'Saving…' : submit}</button></>}>
      <form id={`${id}-f`} ref={form} noValidate onSubmit={e => { e.preventDefault(); go(); }} className="fd">
        {children}
        {fields.filter(f => !f.showIf || f.showIf(v)).map(f => { const fid = `${id}-${f.name}`, msg = err[f.name]; const common = { id: fid, name: f.name, 'aria-invalid': !!msg, 'aria-describedby': msg ? `${fid}-e` : f.hint ? `${fid}-h` : undefined } as const;
          return (<div className={`field${msg ? ' bad' : ''}`} key={f.name}>
            <label htmlFor={fid}>{f.label}{'required' in f && f.required && <span aria-hidden className="req"> *</span>}</label>
            {f.type === 'textarea' ? <textarea {...common} rows={4} value={v[f.name]} placeholder={f.placeholder} onChange={e => setV({ ...v, [f.name]: e.target.value })} />
              : f.type === 'select' ? <select {...common} value={v[f.name]} onChange={e => setV({ ...v, [f.name]: e.target.value })}>{!f.required && <option value="">None</option>}{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : f.type === 'segmented' ? <div className="segc seg-field" role="radiogroup" aria-label={f.label}>{f.options.map(o => <button key={o.value} type="button" role="radio" aria-checked={v[f.name] === o.value} data-on={v[f.name] === o.value} onClick={() => setV({ ...v, [f.name]: o.value })}>{o.label}</button>)}</div>
              : f.type === 'money' ? <div className="adorn"><span aria-hidden>£</span><input {...common} inputMode="decimal" autoComplete="off" value={v[f.name]} placeholder={f.placeholder ?? '0.00'} onChange={e => setV({ ...v, [f.name]: e.target.value })} /></div>
              : <input {...common} type={f.type === 'number' ? 'text' : f.type} inputMode={f.type === 'number' ? 'numeric' : undefined} autoComplete="off" value={v[f.name]} placeholder={'placeholder' in f ? f.placeholder : undefined} onChange={e => setV({ ...v, [f.name]: e.target.value })} />}
            {msg ? <p id={`${fid}-e`} className="ferr" role="alert">{msg}</p> : f.hint && <p id={`${fid}-h`} className="muted fhint">{f.hint}</p>}
          </div>); })}
        {footerNote && <p className="muted fhint">{footerNote}</p>}
      </form>
    </Dialog>
  </>);
}
