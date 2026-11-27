import { gate } from '@/lib/gate';
import { Header } from '@/components/ui';
import { PageEditor } from '@/components/site/PageEditor';
export const metadata = { title: 'New page' };
export default async function NewPage() { await gate('/content'); return (<><Header title="New page" back={{ href: '/content/pages', label: 'Pages' }} /><PageEditor /></>); }
