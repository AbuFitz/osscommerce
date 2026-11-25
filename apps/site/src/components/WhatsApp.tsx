import { MessageCircle } from 'lucide-react';
import { SITE } from '@/config';
export function WhatsApp() { return (<a className="wa" href={SITE.whatsapp.href} aria-label={`Message us on WhatsApp, ${SITE.whatsapp.display}`}><MessageCircle size={20} aria-hidden /><span>Message us</span></a>); }
