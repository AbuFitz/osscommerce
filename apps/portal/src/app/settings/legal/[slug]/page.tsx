import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { LegalEditor } from '@/components/LegalEditor';
export default async function LegalPageEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = (await gateway().legalPages()).find(x => x.slug === slug); if (!p) notFound();
  return (<><Link className="link" href="/settings/legal" style={{ marginBottom: 14 }}><ChevronLeft size={15} aria-hidden />Legal pages</Link><Header title={p.title} eyebrow="Settings" /><LegalEditor page={p} /></>);
}
