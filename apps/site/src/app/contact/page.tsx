import type { Metadata } from 'next';
import { StartButton } from '@/components/Start';
import { SITE } from '@/config';
export const metadata: Metadata = { title: 'Contact', description: 'Talk to the team about your shop.' };
export default function Contact() {
  return (
    <section className="hero"><div className="wrap"><div className="hero-copy">
      <span className="eyebrow">Contact</span><h1 style={{ fontSize: 'clamp(42px,6.4vw,92px)' }}>Talk to a person.</h1>
      <p className="lede">Tell us about your shop and we will reply personally, usually within one working day.</p>
      <div className="acts"><StartButton>Join the pilot</StartButton><a className="btn" href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
      <p className="muted" style={{ maxWidth: '56ch' }}>Looking for a website rather than a shop? Visit <a href={SITE.agencyUrl} style={{ textDecoration: 'underline' }}>onesimplesite.co.uk</a>.</p>
    </div></div></section>
  );
}
