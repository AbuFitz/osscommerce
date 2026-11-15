import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WhatsApp } from '@/components/WhatsApp';
import { SITE } from '@/config';
export const metadata: Metadata = { title: 'Contact', description: 'Message OneSimpleCommerce on WhatsApp or by email, or start your store in three short steps.' };
export default function Contact() {
  return (
    <section className="su"><div className="wrap su-grid">
      <div className="su-side"><p className="kicker">Contact</p><h1>Talk to a person.</h1><p className="lede">Ask us anything about getting a shop built. We answer ourselves.</p></div>
      <div className="su-card ct"><div className="su-contact big"><WhatsApp inline /><p><a href={SITE.whatsapp.href}>WhatsApp {SITE.whatsapp.display}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p></div>
        <p>Ready to get going? Tell us about your business and we will take it from there.</p><Link className="btn green" href="/start">Start your store <ArrowRight size={18} aria-hidden /></Link>
        <p className="su-fine">Looking for a website rather than a shop? Visit <a href={SITE.makerUrl}>onesimplesite.co.uk</a>.</p></div>
    </div></section>
  );
}
