import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import Link from 'next/link';
import { Header } from '@/components/ui';
import { ContentEditor } from '@/components/ContentEditor';
export const metadata = { title: 'Content' };
export default async function Content() {
  await gate('/content');
  const c = await gateway().content();
  return (<><Header title="Content" eyebrow={`${c.page.title} · ${c.page.path}`} /><nav className="seg" aria-label="Content areas" style={{ marginBottom: 14 }}><Link href="/content" aria-current="page">Homepage</Link><Link href="/content/pages">Pages</Link><Link href="/content/menus">Menus</Link></nav>{c.sections.length === 0 ? <div className="w"><div className="empty">Editing your storefront's content from here is not connected for your store yet. Ask us for changes under Help and we will make them.</div></div> : <ContentEditor sections={c.sections} previewUrl={c.previewUrl} publishedAt={c.publishedAt} />}</>);
}
