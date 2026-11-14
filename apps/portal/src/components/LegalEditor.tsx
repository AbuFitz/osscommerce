'use client';
import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { useRun } from './Actions';
import { saveLegal } from '@/app/actions';
import type { LegalPage } from '@/lib/gateway';

const TOKENS = ['{{business name}}', '{{business address}}', '{{support email}}', '{{delivery times}}', '{{returns window}}'];
const GUIDE: Record<LegalPage['slug'], string[]> = {
  privacy: ['Say what personal data you collect and why.', 'Name the services that handle it, such as payments and email.', 'Explain how people can ask to see, correct or delete their data.', 'Give a contact for privacy questions.'],
  terms: ['Say who the seller is and how to reach you.', 'Describe how prices, VAT and payment work.', 'Cover cancellations, delivery and how disputes are handled.'],
  shipping: ['List where you deliver and the options and prices.', 'Give realistic dispatch and delivery times.', 'Say what happens if a parcel is late or lost.'],
  returns: ['State your returns window and how to start a return.', 'Say who pays for return postage and how refunds are made.', 'Do not remove statutory rights for consumers.'],
};

export function LegalEditor({ page }: { page: LegalPage }) {
  const [body, setBody] = useState(page.body); const [confirm, setConfirm] = useState(false); const { run, pending } = useRun();
  const unresolved = TOKENS.filter(t => body.includes(t)).length;
  const dirty = body !== page.body;
  return (
    <div className="grid">
      <section className="w c-8" aria-labelledby="ed">
        <div className="wh"><h2 id="ed">{page.title}</h2><span className={`badge ${page.status === 'published' ? 'ok' : page.status === 'draft' ? 'warn' : ''}`}>{page.status === 'published' ? 'Published' : page.status === 'draft' ? 'Draft' : 'Not set up'}</span></div>
        <div className="field"><label htmlFor="lb" className="sr">Policy text</label>
          <textarea id="lb" value={body} onChange={e => setBody(e.target.value)} rows={16} style={{ padding: 14, borderRadius: 14, border: '1px solid var(--line)', font: 'inherit', lineHeight: 1.55, minHeight: 320 }} /></div>
        <div style={{ margin: '12px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span className="muted" style={{ fontSize: 12.5 }}>Insert:</span>{TOKENS.map(t => <button key={t} type="button" className="btn sm" onClick={() => setBody(b => `${b}${b.endsWith('\n') || !b ? '' : ' '}${t}`)}>{t.replace(/[{}]/g, '')}</button>)}</div>
        {unresolved > 0 && <p className="note" style={{ margin: '0 0 12px' }}>{unresolved} placeholder{unresolved > 1 ? 's' : ''} still need filling in. We fill your business details when you publish; you must still replace any other placeholders.</p>}
        <div className="acts"><button className="btn" type="button" disabled={!dirty || pending} onClick={() => run(() => saveLegal(page.slug, body, false))}>{pending ? 'Saving…' : 'Save draft'}</button><button className="btn primary" type="button" disabled={pending || !body.trim()} onClick={() => setConfirm(true)}>Publish</button></div>
      </section>
      <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="w tint-blue"><div className="wh"><h2>Guidance</h2></div><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>{GUIDE[page.slug].map(g => <li key={g}>{g}</li>)}</ul></section>
        <section className="w flat"><p style={{ margin: 0, display: 'flex', gap: 10 }}><Info size={18} style={{ flex: 'none', marginTop: 2 }} aria-hidden /><span>These are tools to help you write your policies, <b>not legal advice</b>. You are the seller, so check each page suits your business, or ask a professional.</span></p></section>
      </aside>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Publish ${page.title.toLowerCase()}?`} description="It goes live on your shop and replaces the current version. We keep the previous version."
        footer={<><button className="btn" type="button" onClick={() => setConfirm(false)}>Cancel</button><button className="btn primary" type="button" disabled={pending} onClick={() => run(() => saveLegal(page.slug, body, true), () => setConfirm(false))}>{pending ? 'Publishing…' : 'Publish'}</button></>}>
        {unresolved > 0 && <p className="note">This page still contains placeholders. Check the text before publishing.</p>}
      </Dialog>
    </div>
  );
}
