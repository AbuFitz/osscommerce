import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/EnquiryForm';
import { PRICE, SITE } from '@/config';
export const metadata: Metadata = { title: 'Start a store', description: 'Tell us about your business and what you sell. We reply personally about building your store.' };
export default function Contact() {
  return (
    <section className="phd"><div className="wrap">
      <h1>Tell us about your shop.</h1><p className="lede" style={{ marginBottom: 48 }}>A few details are enough to start. We read every enquiry ourselves and reply by email.</p>
      <div className="contact">
        <EnquiryForm />
        <aside className="aside"><h2>What happens next</h2>
          <ol><li>We reply to arrange a short call about your business and products.</li><li>You get a written quote and scope: {PRICE.build} for the build, {PRICE.monthly} a month to run it, plus anything extra you ask for.</li><li>Nothing is built or billed until you agree.</li></ol>
          <p style={{ fontSize: 16 }}>Prefer email? <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
          <p className="muted" style={{ fontSize: 15 }}>Looking for a website rather than a shop? Visit <a href={SITE.makerUrl}>onesimplesite.co.uk</a>.</p></aside>
      </div>
    </div></section>
  );
}
