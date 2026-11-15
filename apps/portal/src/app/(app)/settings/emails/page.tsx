import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { renderTemplate, TEMPLATES, SAMPLE_ORDER, type TemplateId } from '@oss-commerce/emails';
export const metadata = { title: 'Emails' };

export default async function Emails({ searchParams }: { searchParams: Promise<{ t?: string; v?: string; subject?: string; preheader?: string; intro?: string }> }) {
  const q = await searchParams; const s = await gateway().emailSettings(); const v = (['templates', 'edit', 'preview'].includes(q.v ?? '') ? q.v : 'preview') as 'templates' | 'edit' | 'preview';
  const keep = new URLSearchParams(Object.entries({ subject: q.subject, intro: q.intro }).filter(([, x]) => x) as [string, string][]).toString(); const href = (t: string, view = v) => `/settings/emails?t=${t}&v=${view}${keep ? `&${keep}` : ''}`;
  const id = (TEMPLATES.find(x => x.id === q.t)?.id ?? 'order_confirmation') as TemplateId;
  const r = await renderTemplate(id, { shopName: s.brand.shopName, accent: s.brand.accent, supportEmail: s.brand.supportEmail, footer: s.brand.footer }, SAMPLE_ORDER, { subject: q.subject, preheader: q.preheader, intro: q.intro });
  const cur = TEMPLATES.find(x => x.id === id)!;
  return (<>
    <Header title="Emails" back={{ href: '/settings', label: 'Settings' }}>{!s.sendingDomain.verified && <span className="badge warn">Sending domain not verified</span>}</Header>
    <nav className="segc only-m" aria-label="Email view">{([['templates', 'Templates'], ['edit', 'Wording'], ['preview', 'Preview']] as const).map(([k, l]) => <Link key={k} href={href(id, k)} aria-current={v === k}>{l}</Link>)}</nav>
    <div className="grid">
      <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className={`glist only-m ${v === 'templates' ? '' : 'mpane-hide'}`}><section aria-label="Templates"><ul>{TEMPLATES.map(t => <li key={t.id}><Link href={href(t.id, 'preview')}><span className="t"><b>{t.label}</b><span>{t.audience === 'merchant' ? 'Sent to you' : 'Sent to customers'}</span></span>{t.id === id ? <span className="badge ok">Selected</span> : <ChevronRight size={18} className="chev" aria-hidden />}</Link></li>)}</ul></section></div>
        <section className="w only-d" aria-labelledby="tl"><div className="wh"><h2 id="tl">Templates</h2></div>
          <div className="rows">{TEMPLATES.map(t => <Link key={t.id} href={`/settings/emails?t=${t.id}`} className="row" aria-current={t.id === id}><span className="t"><b>{t.label}</b><span>{t.audience === 'merchant' ? 'Sent to you' : 'Sent to customers'}</span></span>{t.id === id && <span className="badge ok">Previewing</span>}</Link>)}</div></section>
        <section className={`w ${v === 'edit' ? '' : 'mpane-hide'} only-d-or-edit`} aria-labelledby="ed"><div className="wh"><h2 id="ed">Customise</h2></div>
          <form method="get" action="/settings/emails" className="field" style={{ gap: 12 }}>
            <input type="hidden" name="t" value={id} /><input type="hidden" name="v" value="preview" />
            <div className="field"><label htmlFor="sj">Subject</label><input id="sj" name="subject" defaultValue={q.subject ?? ''} placeholder={cur.subject(SAMPLE_ORDER, { shopName: s.brand.shopName, accent: '', supportEmail: '' })} /></div>
            <div className="field"><label htmlFor="in">Opening line</label><input id="in" name="intro" defaultValue={q.intro ?? ''} placeholder={cur.intro(SAMPLE_ORDER)} /></div>
            <button className="btn" type="submit">Update preview</button>
          </form>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>You can change the subject, opening line and footer. Order details, totals and legal lines always stay.</p></section>
      </aside>
      <section className={`w c-8 ${v === 'preview' ? '' : 'mpane-hide'}`} aria-labelledby="pv" style={{ padding: 12 }}>
        <div className="wh" style={{ padding: '6px 10px 0' }}><div><h2 id="pv">Preview</h2><div className="muted" style={{ fontSize: 12.5 }}>Subject: {r.subject}</div></div><span className="muted" style={{ fontSize: 12.5 }}>Sample data</span></div>
        <iframe title={`${cur.label} preview`} srcDoc={r.html} sandbox="" style={{ width: '100%', height: 900, border: 0, borderRadius: 18, background: '#f4f3ee' }} />
      </section>
    </div></>);
}
