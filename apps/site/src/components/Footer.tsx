import Link from 'next/link';
import { COMPANY, SITE } from '@/config';
import { Wordmark } from './Brand';
import { PRODUCT } from './nav';
export function Footer() {
  return (<footer className="ft"><div className="wrap">
    <div className="ft-t">
      <div><p className="ft-lead">Your business is unique. Your store should be too.</p><Link className="btn pri" href="/start">Start your store</Link></div>
      <nav aria-label="Product"><h2>Product</h2><ul>{PRODUCT.map(p => <li key={p.href}><Link href={p.href}>{p.label}</Link></li>)}<li><Link href="/how-it-works">How it works</Link></li></ul></nav>
      <nav aria-label="Company"><h2>Company</h2><ul><li><Link href="/pricing">Pricing</Link></li><li><Link href="/contact">Contact</Link></li><li><a href={SITE.whatsapp.href}>WhatsApp</a></li><li><a href={SITE.makerUrl}>OneSimpleSite</a></li>{SITE.social.map(s => <li key={s.href}><a href={s.href} rel="noreferrer">{s.label}</a></li>)}</ul></nav>
      <nav aria-label="Legal"><h2>Legal</h2><ul><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/privacy">Privacy</Link></li><li><Link href="/legal">All policies</Link></li></ul></nav>
    </div>
    <p className="ft-l"><Wordmark /><br /><br />OneSimpleCommerce is a product by {COMPANY.legalName}, registered in {COMPANY.jurisdiction}, company number {COMPANY.companyNumber}. Registered office: {COMPANY.registeredAddress}.</p>
  </div></footer>);
}
