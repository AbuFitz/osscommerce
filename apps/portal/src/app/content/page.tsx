import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { ContentEditor } from '@/components/ContentEditor';
export const metadata = { title: 'Content' };
export default async function Content() {
  const c = await gateway().content();
  return (<><Header title="Content" eyebrow={`${c.page.title} · ${c.page.path}`} /><ContentEditor sections={c.sections} previewUrl={c.previewUrl} publishedAt={c.publishedAt} /></>);
}
