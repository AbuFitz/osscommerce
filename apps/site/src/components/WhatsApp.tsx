import { siWhatsapp } from 'simple-icons';
import { SITE } from '@/config';
/** A quiet floating pill that opens WhatsApp. A plain link: nothing is tracked or sent from this page. */
export function WhatsApp() {
  return (<a className="wa" href={SITE.whatsapp.href} target="_blank" rel="noreferrer" aria-label={`Chat with us on WhatsApp, ${SITE.whatsapp.display}`}><i><svg viewBox="0 0 24 24" aria-hidden><path d={siWhatsapp.path} /></svg></i><span>Chat with us</span></a>);
}
