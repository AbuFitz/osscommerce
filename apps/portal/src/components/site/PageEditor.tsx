'use client';
import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Dialog, useToast } from '@oss-commerce/ui';
import { deleteSitePageAction, saveSitePageAction } from '@/app/actions';
import { plainText } from '@oss-commerce/contracts';
import { slugify, validatePage, type SitePage } from '@/lib/site-content';
const RichTextEditor = dynamic(() => import('@/components/product/RichTextEditor'), { ssr: false, loading: () => <div className="rte"><div className="rte-body" aria-busy /></div> });

/** A page of your own (Our story, Care guide, Contact). Saved as a draft until you publish it, and cleaned to the safe subset either way. */
export function PageEditor({ page, shopUrl }: { page?: SitePage; shopUrl?: string }) {
  const isNew = !page; const toast = useToast(); const router = useRouter(); const [pending, start] = useTransition();
  const [title, setTitle] = useState(page?.title ?? ''); const [slug, setSlug] = useState(page?.slug ?? ''); const [touched, setTouched] = useState(!!page); const [body, setBody] = useState(page?.body ?? ''); const [seo, setSeo] = useState(page?.seoDescription ?? ''); const [del, setDel] = useState(false);
  const draft = { slug, title, body, seoDescription: seo }; const problem = (() => { const v = validatePage(draft, false); return v.ok ? null : v.message; })();
  const save = (publish: boolean) => start(async () => { const r = await saveSitePageAction(draft, publish, isNew); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { if (isNew) router.replace(`/content/pages/${slug}`); else router.refresh(); } });
  const remove = () => start(async () => { const r = await deleteSitePageAction(slug); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) router.replace('/content/pages'); });
  return (<div className="grid">
    <section className="w fd c-8" aria-labelledby="pe-h"><h2 id="pe-h">{isNew ? 'New page' : 'Page'}</h2>
      <div className="field"><label htmlFor="pe-title">Title</label><input id="pe-title" value={title} maxLength={80} onChange={e => { setTitle(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} placeholder="Our story" autoFocus={isNew} /></div>
      <div className="field"><label htmlFor="pe-slug">Address</label><input id="pe-slug" value={slug} maxLength={60} disabled={!isNew} onChange={e => { setTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} aria-describedby="pe-slug-h" /><small id="pe-slug-h" className="muted">{isNew ? 'Letters, numbers and dashes. It cannot be changed later.' : 'The address is fixed once the page exists.'} Your page: {shopUrl ?? 'your shop'}/pages/{slug || '…'}</small></div>
      <div className="field"><label htmlFor="pe-body">Content</label><RichTextEditor id="pe-body" value={body} onChange={setBody} placeholder="Write what you want shoppers to read." /></div>
      <div className="field"><div className="pf-lab"><label htmlFor="pe-seo">Search description <span className="muted">(optional)</span></label><span className="muted" style={{ fontSize: 12 }}>{seo.length}/160</span></div><textarea id="pe-seo" rows={2} maxLength={160} value={seo} onChange={e => setSeo(e.target.value)} placeholder={plainText(body).slice(0, 155) || 'A short summary shown in search results.'} /></div>
    </section>
    <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
      <section className="w" aria-labelledby="pe-p"><h2 id="pe-p" style={{ marginBottom: 8 }}>Publish</h2>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>{page ? (page.status === 'published' ? 'Live on your store. Saving a draft does not change what shoppers see; publish to update it.' : 'Not on your store yet.') : 'Not on your store yet.'}</p>
        {problem && title.trim() && <p className="note" aria-live="polite">{problem}</p>}
        <div className="acts" style={{ flexDirection: 'column', alignItems: 'stretch' }}><button className="btn primary" type="button" disabled={pending || !!problem} onClick={() => save(true)} aria-busy={pending}>{pending ? 'Saving…' : 'Publish'}</button><button className="btn" type="button" disabled={pending || !!problem} onClick={() => save(false)}>Save draft</button>{!isNew && <button className="btn" type="button" disabled={pending} onClick={() => setDel(true)}>Delete page</button>}</div></section>
    </aside>
    <Dialog open={del} onClose={() => !pending && setDel(false)} title="Delete this page?" description="It stops showing on your store straight away. Links to it will lead nowhere, so update your menus too."
      footer={<><button className="btn" type="button" onClick={() => setDel(false)} disabled={pending}>Keep</button><button className="btn danger" type="button" onClick={remove} disabled={pending}>{pending ? 'Deleting…' : 'Delete'}</button></>}><span /></Dialog>
  </div>);
}
