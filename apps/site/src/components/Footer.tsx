import Link from 'next/link';
import { COMPANY, SITE } from '@/config';
import { FEATURES } from '@/content/features';
import { Wordmark } from './SiteHeader';

export function Footer() {
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft-top">
          <div><p className="ft-lead">We build the store. You run the business.</p><Link className="btn green" href="/start">Start your store</Link></div>
          <nav aria-label="Sell"><h2>Sell</h2><ul>{FEATURES.filter(f => f.group === 'Sell').map(f => <li key={f.slug}><Link href={`/features/${f.slug}`}>{f.nav}</Link></li>)}</ul></nav>
          <nav aria-label="Manage"><h2>Manage</h2><ul>{FEATURES.filter(f => f.group === 'Manage').map(f => <li key={f.slug}><Link href={`/features/${f.slug}`}>{f.nav}</Link></li>)}<li><Link href="/platform">The whole platform</Link></li></ul></nav>
          <nav aria-label="Company"><h2>Company</h2><ul><li><Link href="/how-it-works">How it works</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/contact">Contact</Link></li><li><a href={SITE.whatsapp.href}>WhatsApp</a></li><li><a href={SITE.makerUrl}>OneSimpleSite</a></li><li><Link href="/legal">Legal</Link></li></ul></nav>
        </div>
        <div className="ft-big" aria-hidden><Wordmark /></div>
        <p className="ft-legal">OneSimpleCommerce is a product by {COMPANY.legalName}, registered in {COMPANY.jurisdiction}, company number {COMPANY.companyNumber}. Registered office: {COMPANY.registeredAddress}.</p>
      </div>
    </footer>
  );
}
