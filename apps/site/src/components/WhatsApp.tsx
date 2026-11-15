import { siWhatsapp } from 'simple-icons';
import { SITE } from '@/config';
/** Floating WhatsApp link with the label turning around it. A plain link: it opens WhatsApp, nothing is tracked or sent from this page. */
export function WhatsApp({ inline }: { inline?: boolean }) {
  return (<a className={`wa${inline ? ' wa-inline' : ''}`} href={SITE.whatsapp.href} target="_blank" rel="noreferrer" aria-label={`Message us on WhatsApp, ${SITE.whatsapp.display}`}>
    <svg className="wa-ring" viewBox="0 0 120 120" aria-hidden><defs><path id="wa-c" d="M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" /></defs><text><textPath href="#wa-c">MESSAGE US ON WHATSAPP · MESSAGE US ON WHATSAPP · </textPath></text></svg>
    <svg className="wa-ic" viewBox="0 0 24 24" aria-hidden><path d={siWhatsapp.path} /></svg>
  </a>);
}
