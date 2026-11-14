import Link from 'next/link';
import { SITE, COMPANY } from '@/config';
import { LEGAL_DOCS } from '@/content/legal';
import { Wordmark } from './Wordmark';

export function Footer() {
  return (
    <footer className="ftr"><div className="wrap">
      <div className="fcols">
        <div><Link href="/" aria-label="Home"><Wordmark /></Link>
          <p style={{ marginTop: 18, maxWidth: '34ch', color: 'var(--on-dark-2)' }}>Custom-built online shops, managed for you. From the team behind <a href={SITE.agencyUrl} style={{ textDecoration: 'underline' }}>onesimplesite.co.uk</a>.</p>
          <p style={{ marginTop: 16 }}><a href={`mailto:${SITE.email}`} style={{ fontWeight: 600 }}>{SITE.email}</a></p></div>
        <div><h4>Product</h4><ul><li><Link href="/storefronts">Storefronts</Link></li><li><Link href="/#dashboard">The platform</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
        <div><h4>Legal</h4><ul>{LEGAL_DOCS.map(d => <li key={d.slug}><Link href={`/legal/${d.slug}`}>{d.short}</Link></li>)}</ul></div>
        <div><h4>Follow</h4><ul>{SITE.social.map(s => <li key={s.href}><a href={s.href} rel="noopener noreferrer">{s.label}</a></li>)}</ul></div>
      </div>
      <div className="fbase"><span>© {new Date().getFullYear()} {COMPANY.legalName}. Registered in {COMPANY.jurisdiction}, no. {COMPANY.companyNumber}. Registered office: {COMPANY.registeredAddress}.</span><span>No tracking or advertising cookies on this site.</span></div>
    </div></footer>
  );
}
