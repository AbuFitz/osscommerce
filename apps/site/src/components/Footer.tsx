import Link from 'next/link';
import { SITE } from '@/config';
import { LEGAL_DOCS } from '@/content/legal';

export function Footer() {
  return (
    <footer className="ftr"><div className="wrap">
      <div className="fcols">
        <div><div className="word">{SITE.name}<i>{SITE.product}</i></div>
          <p className="muted" style={{ marginTop: 14, maxWidth: 34 + 'ch' }}>Online shops that make sense. A service from the team behind <a href={SITE.agencyUrl} style={{ textDecoration: 'underline' }}>OneSimpleSite</a>, fixed-price websites for UK businesses.</p>
          <p style={{ marginTop: 14 }}><a href={`mailto:${SITE.email}`} style={{ fontWeight: 550 }}>{SITE.email}</a></p></div>
        <div><h4>Product</h4><ul><li><Link href="/storefronts">Storefronts</Link></li><li><Link href="/#tour">The platform</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/contact">Contact</Link></li></ul></div>
        <div><h4>Legal</h4><ul>{LEGAL_DOCS.map(d => <li key={d.slug}><Link href={`/legal/${d.slug}`}>{d.short}</Link></li>)}</ul></div>
        <div><h4>Follow</h4><ul>{SITE.social.map(s => <li key={s.href}><a href={s.href} rel="noopener noreferrer">{s.label}</a></li>)}</ul></div>
      </div>
      <div className="fbase"><span>© {new Date().getFullYear()} OneSimpleSite. All rights reserved.</span><span>No tracking or advertising cookies on this site.</span></div>
    </div></footer>
  );
}
