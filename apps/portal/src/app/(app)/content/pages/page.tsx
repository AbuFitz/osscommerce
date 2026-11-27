import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { day } from '@/lib/format';
import { Header } from '@/components/ui';
export const metadata = { title: 'Pages' };
export default async function Pages() {
  await gate('/content'); const pages = await gateway().sitePages();
  return (<><Header title="Pages" eyebrow={`${pages.length} page${pages.length === 1 ? '' : 's'}`}><Link className="btn primary" href="/content/pages/new">New page</Link></Header>
    <nav className="seg" aria-label="Content areas" style={{ marginBottom: 14 }}><Link href="/content">Homepage</Link><Link href="/content/pages" aria-current="page">Pages</Link><Link href="/content/menus">Menus</Link></nav>
    {pages.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No pages yet</b><p style={{ margin: '6px 0 0' }}>Add pages like Our story, a care guide or contact details, then link to them from your menus.</p></div>
      : <div className="w" style={{ padding: 10 }}><div className="rows">{pages.map(p => (<Link key={p.slug} href={`/content/pages/${p.slug}`} className="row" style={{ minHeight: 60 }}><span className="t"><b>{p.title}</b><span>/pages/{p.slug} · Updated {p.updatedAt ? day(p.updatedAt) : ''}</span></span><span className={`badge ${p.status === 'published' ? 'ok' : 'warn'}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span><ChevronRight size={16} aria-hidden /></Link>))}</div></div>}
    <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Your privacy, terms, shipping and returns pages are under Settings, then Legal pages.</p></>);
}
