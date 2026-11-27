'use client';
import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { MAX_SEGMENT_RULES, OP_LABEL, SEGMENT_FIELDS, describeSegment, validateSegment, type SegmentDefinition, type SegmentField, type SegmentOp, type SegmentRule } from '@oss-commerce/contracts';
import { deleteSegmentAction, saveSegmentAction } from '@/app/actions';
import type { SavedSegment } from '@/lib/gateway';

const FIELDS = Object.keys(SEGMENT_FIELDS) as SegmentField[];
const blank = (): SegmentRule => ({ field: 'orders', op: 'gte', value: 2 });
type Draft = { name: string; match: 'all' | 'any'; rules: { field: SegmentField; op: SegmentOp; value: string }[] };
const toDraft = (s?: SavedSegment): Draft => s ? { name: s.name, match: s.definition.match, rules: s.definition.rules.map(r => ({ ...r, value: String(r.value) })) } : { name: '', match: 'all', rules: [{ ...blank(), value: '2' }] };
const toDef = (d: Draft): SegmentDefinition => ({ match: d.match, rules: d.rules.map(r => ({ field: r.field, op: r.op, value: r.value.trim() === '' ? NaN : Number(r.value) })) });

/** Make, change or delete a segment. The rules read back in plain words as they are built, and what is wrong is said before anything is sent. */
export function SegmentBuilder({ segment, trigger }: { segment?: SavedSegment; trigger: React.ReactNode }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [d, setD] = useState<Draft>(() => toDraft(segment)); const [err, setErr] = useState(''); const [del, setDel] = useState(false);
  const show = () => { setD(toDraft(segment)); setErr(''); setDel(false); setOpen(true); };
  const def = toDef(d); const problem = validateSegment(d.name, def);
  const setRule = (i: number, p: Partial<Draft['rules'][number]>) => setD(x => ({ ...x, rules: x.rules.map((r, k) => k === i ? { ...r, ...p } : r) }));
  const onField = (i: number, field: SegmentField) => { const f = SEGMENT_FIELDS[field]; setRule(i, { field, op: f.ops.includes(d.rules[i].op) ? d.rules[i].op : f.ops[0], value: field === 'marketing' ? '1' : d.rules[i].value }); };
  const save = () => start(async () => { const r = await saveSegmentAction({ id: segment?.id, name: d.name, definition: def }); if (!r.ok) { setErr(r.message); return; } toast(r.message, 'ok'); setOpen(false); });
  const remove = () => start(async () => { const r = await deleteSegmentAction(segment!.id); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) setOpen(false); });
  return (<>
    <span onClick={show} style={{ display: 'contents' }}>{trigger}</span>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title={segment ? 'Edit segment' : 'New segment'} description="Choose who belongs. It updates by itself as customers order."
      footer={del ? <><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep it</button><button className="btn danger" type="button" onClick={remove} disabled={pending}>{pending ? 'Deleting…' : 'Delete segment'}</button></>
        : <>{segment && <button className="btn ghost" type="button" onClick={() => setDel(true)} disabled={pending}>Delete</button>}<button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" onClick={save} disabled={pending || !!problem} aria-busy={pending}>{pending ? 'Saving…' : 'Save segment'}</button></>}>
      {del ? <p style={{ margin: 0 }}>Delete <b>{segment!.name}</b>? The customers in it are not affected.</p> : (<div className="stack">
        <div className="field"><label htmlFor="sg-name">Name</label><input id="sg-name" value={d.name} maxLength={60} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Best customers" autoFocus={!segment} /></div>
        <div className="field"><label htmlFor="sg-match">A customer belongs when</label><select id="sg-match" value={d.match} onChange={e => setD({ ...d, match: e.target.value as 'all' | 'any' })}><option value="all">every rule is true</option><option value="any">any rule is true</option></select></div>
        <ul className="sg-rules" aria-label="Rules">{d.rules.map((r, i) => { const f = SEGMENT_FIELDS[r.field]; return (<li key={i}>
          <label className="sr" htmlFor={`sg-f${i}`}>Rule {i + 1}: what to look at</label><select id={`sg-f${i}`} value={r.field} onChange={e => onField(i, e.target.value as SegmentField)}>{FIELDS.map(k => <option key={k} value={k}>{SEGMENT_FIELDS[k].label}</option>)}</select>
          {r.field === 'marketing' ? <><label className="sr" htmlFor={`sg-v${i}`}>Value</label><select id={`sg-v${i}`} value={r.value} onChange={e => setRule(i, { value: e.target.value, op: 'eq' })}><option value="1">Yes</option><option value="0">No</option></select></>
            : <><label className="sr" htmlFor={`sg-o${i}`}>Comparison</label><select id={`sg-o${i}`} value={r.op} onChange={e => setRule(i, { op: e.target.value as SegmentOp })}>{f.ops.map(o => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select>
              <label className="sr" htmlFor={`sg-v${i}`}>Amount</label><input id={`sg-v${i}`} inputMode="decimal" value={r.value} onChange={e => setRule(i, { value: e.target.value.replace(/[^0-9.]/g, '') })} aria-describedby={`sg-u${i}`} /><span id={`sg-u${i}`} className="muted sg-unit">{f.unit}</span></>}
          <button type="button" className="iconbtn" aria-label={`Remove rule ${i + 1}`} disabled={d.rules.length === 1} onClick={() => setD({ ...d, rules: d.rules.filter((_, k) => k !== i) })}><Trash2 size={15} aria-hidden /></button></li>); })}</ul>
        {d.rules.length < MAX_SEGMENT_RULES && <button type="button" className="btn sm" onClick={() => setD({ ...d, rules: [...d.rules, { ...blank(), value: '1' }] })}><Plus size={14} aria-hidden />Add a rule</button>}
        <p className="note" aria-live="polite">{problem && d.name.trim() ? problem : problem && !d.name.trim() ? 'Give it a name to save.' : describeSegment(def)}</p>
        {err && <p className="err" role="alert">{err}</p>}
      </div>)}
    </Dialog>
  </>);
}
