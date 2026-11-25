import type { Metadata } from 'next';
import { SITE } from '@/config';
import { PageHead } from '@/components/Sections';
export const metadata: Metadata = { title: 'Contact' };
export default function Page() {
  return (<div style={{ minHeight: '70vh', display: 'grid' }}><PageHead tone="dk" tag="Contact" title={<>Say <span className="grad">hello.</span></>} lede="Message us and a person answers.">
    <a className="btn pri" style={{ background: '#fff', color: '#09090b' }} href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a className="btn" href={`mailto:${SITE.email}`}>{SITE.email}</a></PageHead></div>);
}
