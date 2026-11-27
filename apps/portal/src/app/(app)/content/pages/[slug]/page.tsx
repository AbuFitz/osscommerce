import { notFound } from 'next/navigation';
import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { PageEditor } from '@/components/site/PageEditor';
export const metadata = { title: 'Edit page' };
export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await gate('/content'); const { slug } = await params; const page = (await gateway().sitePages()).find(p => p.slug === slug); if (!page) notFound();
  return (<><Header title={page.title} back={{ href: '/content/pages', label: 'Pages' }} /><PageEditor page={page} /></>);
}
