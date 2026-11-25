import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { ContentEditor } from '@/components/ContentEditor';
export const metadata = { title: 'Content' };
export default async function Content() {
  await gate('/content');
  const c = await gateway().content();
  return (<><Header title="Content" eyebrow={`${c.page.title} · ${c.page.path}`} />{c.sections.length === 0 ? <div className="w"><div className="empty">Editing your storefront's content from here is not connected for your store yet. Ask us for changes under Help and we will make them.</div></div> : <ContentEditor sections={c.sections} previewUrl={c.previewUrl} publishedAt={c.publishedAt} />}</>);
}
