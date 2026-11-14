import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_DOCS } from '@/content/legal';
export const metadata: Metadata = { title: 'Legal' };
export default function Legal() {
  return (
    <div className="doc"><h1>Legal</h1><p className="muted" style={{ marginTop: 14 }}>The terms and policies that apply to Commerce.</p>
      <div className="legal-list">{LEGAL_DOCS.map(d => <Link key={d.slug} href={`/legal/${d.slug}`}><div>{d.short}<br /><span>{d.blurb}</span></div></Link>)}</div></div>
  );
}
