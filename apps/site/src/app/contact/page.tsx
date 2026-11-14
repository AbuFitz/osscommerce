import type { Metadata } from 'next';
import { StartButton } from '@/components/Start';
import { SITE } from '@/config';
export const metadata: Metadata = { title: 'Contact', description: 'Talk to the team about your shop.' };
export default function Contact() {
  return (
    <section className="dark" style={{ minHeight: '80svh' }}><div className="wrap ph"><h1>Talk to a person.</h1><p className="lede sub">Tell us about your shop and we will reply personally, usually within one working day.</p>
      <div className="acts" style={{ marginTop: 36 }}><StartButton className="btn white">Start your store</StartButton><a className="btn ghost" href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
      <p className="sub" style={{ marginTop: 40, maxWidth: '52ch', color: 'var(--on-dark-2)' }}>Looking for a website rather than a shop? Visit <a href={SITE.agencyUrl} style={{ textDecoration: 'underline' }}>onesimplesite.co.uk</a>.</p></div></section>
  );
}
