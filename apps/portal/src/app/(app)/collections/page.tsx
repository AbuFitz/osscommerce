import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { CollectionCard, NewCollectionButton } from '@/components/CollectionEditor';
export const metadata = { title: 'Collections' };
export default async function Collections() {
  await gate('/collections');
  const cs = await gateway().collections();
  return (<><Header title="Collections" eyebrow={`${cs.length} collection${cs.length === 1 ? '' : 's'}`} back={{ href: '/products', label: 'Products' }}><NewCollectionButton /></Header>
    {cs.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No collections yet</b><p style={{ margin: '6px 0 0' }}>Collections group products on your website, like a shelf. Create one from a word in your product names, or pick the products yourself.</p></div>
      : <div className="igrid">{cs.map(c => <CollectionCard key={c.id} c={c} />)}</div>}</>);
}
