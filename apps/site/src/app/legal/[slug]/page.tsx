import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { COMPANY, LEGAL } from '@/config';
import { LEGAL_DOCS, getDoc, type Block } from '@/content/legal';

export const dynamicParams = false;
export const generateStaticParams = () => LEGAL_DOCS.map(d => ({ slug: d.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = getDoc((await params).slug); return d ? { title: d.short, description: d.blurb } : {};
}
const render = (b: Block, i: number) => typeof b === 'string' ? <p key={i}>{b}</p>
  : Array.isArray(b) ? <ul key={i}>{b.map(x => <li key={x}>{x}</li>)}</ul>
  : <table key={i}><thead><tr>{b.table.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{b.table.rows.map((r, n) => <tr key={n}>{r.map((c, m) => <td key={m}>{c}</td>)}</tr>)}</tbody></table>;

export default async function LegalDoc({ params }: { params: Promise<{ slug: string }> }) {
  const d = getDoc((await params).slug); if (!d) notFound();
  const missing = Object.values(COMPANY).some(v => !v);
  return (
    <article className="doc">
      <h1>{d.title}</h1><p className="muted" style={{ marginTop: 14 }}>Last updated {LEGAL.updated}</p>
      {!LEGAL.reviewed && <div className="draft" role="note"><Info size={20} aria-hidden style={{ flex: 'none', marginTop: 2 }} /><div><b>Draft for legal review.</b> This document has not yet been approved by a solicitor and is not yet in force.{missing ? ' Company registration details will be added before launch.' : ''}</div></div>}
      <p style={{ marginTop: 18 }}>{d.blurb}</p>
      {d.sections.map(s => <section key={s.h}><h2>{s.h}</h2>{(Array.isArray(s.body) ? s.body : [s.body]).map(render)}</section>)}
      {COMPANY.legalName && <><h2>Who we are</h2><p>{COMPANY.legalName}{COMPANY.companyNumber ? `, company number ${COMPANY.companyNumber}` : ''}{COMPANY.registeredAddress ? `, ${COMPANY.registeredAddress}` : ''}.</p></>}
    </article>
  );
}
