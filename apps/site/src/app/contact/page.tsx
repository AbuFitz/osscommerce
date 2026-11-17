import type { Metadata } from 'next';
import { SITE } from '@/config';
import { PageHead } from '@/components/Parts';
export const metadata: Metadata = { title: 'Contact' };
export default function Page() {
  return (<><PageHead tag="Contact" title={<>Say <span className="it" style={{ color: 'var(--green)' }}>hello.</span></>} lede="Message us and a person answers.">
    <a className="btn go" href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a className="btn ln" href={`mailto:${SITE.email}`}>{SITE.email}</a></PageHead></>);
}
