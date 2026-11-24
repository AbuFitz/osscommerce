'use client';
import { useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { useRun } from './Actions';
import { publishContent, saveSection } from '@/app/actions';
import type { ContentSection } from '@/lib/gateway';
import { HOME_SECTION_SCHEMA, safeContentLink, type ContentField } from '@/lib/homepage-content';
import { when } from '@/lib/format';

/** Merchants edit content, never layout. Each section type declares its fields, limits and validation. */
const label = { announcement: 'Announcement', hero: 'Hero', image_text: 'Text block', product_row: 'Product row', faq: 'FAQ' } as const;

function Editor({ s, onClose }: { s: ContentSection; onClose: () => void }) {
  const { run, pending } = useRun();
  const fields = HOME_SECTION_SCHEMA[s.type]; const [v, setV] = useState<Record<string, string>>(s.fields);
  const err = (f: ContentField) => (f.required && !v[f.key]?.trim() ? 'Required.' : (v[f.key] ?? '').length > f.max ? `Keep it under ${f.max} characters.` : f.link && !safeContentLink(v[f.key] ?? '') ? 'Use a page starting with / or a full https:// address.' : '');
  const bad = fields.some(f => err(f));
  return (
    <Dialog open onClose={onClose} title={`Edit ${s.label.toLowerCase()}`} description="Saved as a draft. Nothing changes on your live shop until you publish."
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" disabled={bad || pending} onClick={() => run(() => saveSection(s.id, v), onClose)}>{pending ? 'Saving…' : 'Save draft'}</button></>}>
      {fields.map(f => { const e = err(f); const id = `f-${s.id}-${f.key}`; return (
        <div className="field" key={f.key}><label htmlFor={id}>{f.label}{f.required && <span className="muted"> (required)</span>}</label>
          {f.multiline ? <textarea id={id} rows={4} value={v[f.key] ?? ''} onChange={x => setV({ ...v, [f.key]: x.target.value })} aria-invalid={!!e} style={{ padding: 12, minHeight: 96, borderRadius: 12, border: '1px solid var(--line)', font: 'inherit' }} /> : <input id={id} value={v[f.key] ?? ''} onChange={x => setV({ ...v, [f.key]: x.target.value })} aria-invalid={!!e} />}
          <small className={e ? 'err' : 'muted'}>{e || f.hint || ''}{!e && <span style={{ float: 'right' }}>{(v[f.key] ?? '').length}/{f.max}</span>}</small></div>); })}
    </Dialog>
  );
}

export function ContentEditor({ sections, previewUrl, publishedAt }: { sections: ContentSection[]; previewUrl: string; publishedAt: string }) {
  const [edit, setEdit] = useState<ContentSection | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useRun();
  const changed = sections.filter(s => s.changed);
  return (
    <>
      <div className="w" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div><b style={{ fontWeight: 600 }}>{changed.length ? `${changed.length} section${changed.length > 1 ? 's' : ''} changed since you last published` : 'Everything is published'}</b><div className="muted" style={{ fontSize: 13 }}>{publishedAt ? `Last published ${when(publishedAt)}` : 'Not published yet'}</div></div>
        <div className="acts">{previewUrl !== '#' && <a className="btn" href={previewUrl} target="_blank" rel="noreferrer">View shop <ExternalLink size={15} aria-hidden /></a>}<button className="btn primary" type="button" disabled={!changed.length} onClick={() => setConfirm(true)}>Publish changes</button></div>
      </div>
      <div className="rows" style={{ gap: 10 }}>
        {sections.map((s, i) => (
          <div key={s.id} className="w" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span className="num muted" style={{ width: 22 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontWeight: 600 }}>{s.label}</b> <span className="muted" style={{ fontSize: 12.5 }}>· {label[s.type]}</span>
                <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{Object.values(s.fields).filter(Boolean)[0]}</div></div>
              {s.changed && <span className="badge warn">Draft changes</span>}
              <button className="btn sm" type="button" onClick={() => setEdit(s)}><Pencil size={14} aria-hidden /> Edit</button>
            </div>
          </div>))}
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Sections and their order are part of your design. To add a new kind of section or change the layout, send a request from Support.</p>
      {edit && <Editor s={edit} onClose={() => setEdit(null)} />}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Publish to your live shop?" description={`${changed.length} section${changed.length > 1 ? 's' : ''} will go live within about a minute. The previous published revision is retained.`}
        footer={<><button className="btn" type="button" onClick={() => setConfirm(false)}>Keep editing</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => publishContent(), () => setConfirm(false))}>{pending ? 'Publishing…' : 'Publish'}</button></>}>
        <ul className="dlg-list">{changed.map(s => <li key={s.id}>{s.label}</li>)}</ul>
      </Dialog>
    </>
  );
}
