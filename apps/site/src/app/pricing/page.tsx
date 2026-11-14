import type { Metadata } from 'next';
import { PricingTable, FeeExample } from '@/components/Pricing';
import { StartButton } from '@/components/Start';
export const metadata: Metadata = { title: 'Pricing', description: 'A one-off fee for your custom storefront, a monthly fee for the platform we run, and a small fee on sales.' };
const FAQ = [
  ['What does the monthly fee cover?', 'Access to the platform and dashboard, managed hosting, security, monitoring and maintenance, payment infrastructure, essential integrations, defined technical support and standard updates.'],
  ['What is the storefront build?', 'A custom design and build of your shop, scoped and quoted as a fixed price before work starts. The prices shown are starting points.'],
  ['What is not included?', 'Stripe’s payment processing fees, domain renewals, VAT, and extra work such as design changes, product uploads, content creation and additional integrations, which are quoted separately.'],
  ['Is there a contract?', 'The platform runs month to month on 30 days’ notice. The storefront build is a fixed-price project with its own terms.'],
];
export default function Pricing() {
  return (
    <>
      <section className="dark"><div className="wrap ph"><h1>Clear pricing. Clearly separate.</h1><p className="lede sub">A one-off fee for the storefront we build, a monthly fee for the platform we run, and a small fee on sales.</p></div></section>
      <section className="sect bone" style={{ paddingTop: 'clamp(48px,6vw,88px)' }}><div className="wrap">
        <PricingTable />
        <div className="notin">
          <div><b>Not included</b><p>Payment processing fees are charged by Stripe to your account. Your domain renewal and VAT are separate.</p></div>
          <div><b>Extra work is separate</b><p>Design changes, product uploads, content creation and additional integrations are services we quote before we start. Request them in the portal.</p></div>
        </div>
        <FeeExample />
      </div></section>
      <section className="sect light"><div className="wrap"><h2 style={{ maxWidth: '12ch' }}>Pricing questions.</h2>
        <div className="qa">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 40 }}><StartButton>Start your store</StartButton></div></div></section>
    </>
  );
}
