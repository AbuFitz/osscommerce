import Link from 'next/link';
import { COMPANY, NAV, SITE } from '@/config';
import { Wordmark } from './SiteHeader';

export function Footer() {
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft-top">
          <div><p className="ft-lead">A shop built for your business, and the tools to run it.</p><Link className="btn green" href="/start">Start your store</Link></div>
          <nav aria-label="Product"><h2>Product</h2><ul>{NAV.map(n => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}</ul></nav>
          <nav aria-label="Company"><h2>Company</h2><ul><li><Link href="/contact">Contact</Link></li><li><a href={SITE.whatsapp.href}>WhatsApp</a></li><li><a href={SITE.makerUrl}>OneSimpleSite</a></li>{SITE.social.map(s => <li key={s.href}><a href={s.href} rel="noreferrer">{s.label}</a></li>)}</ul></nav>
          <nav aria-label="Legal"><h2>Legal</h2><ul><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal">All policies</Link></li></ul></nav>
        </div>
        <div className="ft-big" aria-hidden><Wordmark /></div>
        <p className="ft-legal">OneSimpleCommerce is a product by {COMPANY.legalName}, registered in {COMPANY.jurisdiction}, company number {COMPANY.companyNumber}. Registered office: {COMPANY.registeredAddress}.</p>
      </div>
    </footer>
  );
}
