import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { CreateCollection } from '@/components/Collections';
export const metadata = { title: 'Collections' };
export default async function Collections() {
  const cs = await gateway().collections();
  return (<><Header title="Collections" back={{ href: '/products', label: 'Products' }}><CreateCollection /></Header>
    {cs.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No collections yet</b><p style={{ margin: '6px 0 0' }}>Collections group products on your website, like a shelf. Create one from a word in your product names.</p></div>
      : <div className="igrid">{cs.map(c => (<article key={c.id} className="w ccard"><h2>{c.name}</h2><p className="muted">Name contains <b>“{c.contains}”</b></p><div className="cnum"><span className="num">{c.count}</span><span className="muted">variants in {c.products.length} product{c.products.length === 1 ? '' : 's'}</span></div><p className="muted" style={{ margin: 0, fontSize: 13 }}>{c.products.join(', ') || 'No products match right now.'}</p></article>))}</div>}</>);
}
