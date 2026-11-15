import Link from 'next/link';
import { CATALOGUE, readyToAdvertise } from '@oss-commerce/integrations';
import { Header } from '@/components/ui';
import { IntegrationCard, type Card } from '@/components/IntegrationCard';
export const metadata = { title: 'Integrations' };

const BRAND: Record<string, string> = { stripe_connect: 'stripe', stripe_tax: 'stripe', royal_mail_click_drop: 'royalmail', shipstation: 'shipstation', postcodes_io: 'postcodes', ideal_postcodes: 'idealpostcodes', meilisearch: 'meilisearch', cloudinary: 'cloudinary', printful: 'printful', printify: 'printify', shipbob: 'shipbob', gs1_uk: 'gs1', maplibre_maps: 'maplibre', resend_email: 'resend' };
const CAT: Record<string, string> = { payments: 'Payments', tax: 'Tax', shipping: 'Shipping', address: 'Addresses', search: 'Search', media: 'Media', fulfilment: 'Fulfilment', print_on_demand: 'Print on demand', identifiers: 'Barcodes', automation: 'Automation', maps: 'Maps', email: 'Email' };

export default async function Integrations({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams; const cats = [...new Set(CATALOGUE.map(m => m.category))];
  const cards: Card[] = CATALOGUE.filter(m => !c || m.category === c).map(m => ({ id: m.id, name: m.name, brand: BRAND[m.id] ?? m.id, category: CAT[m.category] ?? m.category, summary: m.summary, availability: m.availability, payer: m.cost.payer, costNote: m.cost.note, docsUrl: m.docsUrl, regions: m.regions, notes: m.notes, missing: readyToAdvertise(m).missing }));
  const live = CATALOGUE.filter(m => m.availability === 'available').length;
  return (<><Header title="Integrations" back={{ href: '/settings', label: 'Settings' }} />
    <p className="muted" style={{ margin: '-6px 0 16px', maxWidth: 560 }}>{live === 0 ? 'Nothing here is switched on yet. Each one is shown with where it stands, so you can see what is coming and ask for what matters to you.' : `${live} available.`}</p>
    <nav className="chips" aria-label="Category"><Link href="/settings/integrations" aria-current={!c}>All</Link>{cats.map(k => <Link key={k} href={`/settings/integrations?c=${k}`} aria-current={c === k}>{CAT[k] ?? k}</Link>)}</nav>
    <div className="igrid">{cards.map(x => <IntegrationCard key={x.id} c={x} />)}</div></>);
}
