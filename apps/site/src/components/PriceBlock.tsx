import { Check } from 'lucide-react';
import { PRICE } from '@/config';
const BUILD = [['Design', 'A storefront designed around your brand, products and customers.'], ['Development', 'Home, collection, product, basket and checkout pages, built for phones first.'], ['Set-up', 'Payments, delivery zones and VAT settings configured with you.'], ['Testing', 'The whole buying journey checked on phones and desktops.'], ['Launch', 'Your store live on your own domain.']] as const;
const RUN = ['Your dashboard for products, orders, stock, customers and discounts', 'Managed hosting and security updates', 'Monitoring and maintenance', 'Technical support from the team who built it', 'New platform features as they ship'];
/** The build is an itemised statement so the one-off fee reads as work delivered. */
export function PriceBlock() {
  return (<div className="pb">
    <section className="pb-build" aria-label="The build"><header><h3>Your store, designed and built</h3><p>Everything it takes to go from an idea to a shop that is open for orders.</p></header>
      <ul>{BUILD.map(([t, d]) => <li key={t}><Check size={16} aria-hidden /><span><b>{t}</b>{d}</span></li>)}</ul><footer><span>One-time build fee</span><b className="fig">{PRICE.build}</b></footer></section>
    <section className="pb-run" aria-label="Running it"><header><h3>Everything to run it</h3><p>The platform, the hosting and the technical upkeep, so you can get on with selling.</p></header>
      <p className="pb-amt"><b className="fig">{PRICE.monthly}</b><span>a month</span></p><ul>{RUN.map(x => <li key={x}><Check size={16} aria-hidden /><span>{x}</span></li>)}</ul></section>
  </div>);
}
