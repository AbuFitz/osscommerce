import { notFound } from 'next/navigation';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { PhotoManager } from '@/components/PhotoManager';
import { photoStore, callerNow } from '@/lib/handoff';
export const metadata = { title: 'Product' };
const tone = { published: 'ok', draft: 'warn', archived: '' } as const; const label = { published: 'Published', draft: 'Draft', archived: 'Archived' } as const;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = (await gateway().products()).find(x => x.id === id); if (!p) notFound();
  const photos = photoStore().list((await callerNow()).storeId, p.id);
  return (<><Header title={p.title} back={{ href: '/products', label: 'Products' }}><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span></Header>
    <div className="grid">
      <section className="w c-8" aria-labelledby="ph"><div className="wh"><h2 id="ph">Photos</h2></div><PhotoManager productId={p.id} title={p.title} coverUrl={p.imageUrl} initial={photos} /></section>
      <section className="w c-4" aria-labelledby="dt"><div className="wh"><h2 id="dt">Details</h2></div>
        <dl className="kv"><dt>Price</dt><dd className="num">{money(p.priceMinor)}</dd><dt>SKU</dt><dd className="mono">{p.sku}</dd><dt>Variants</dt><dd className="num">{p.variants}</dd><dt>In stock</dt><dd className="num">{p.onHand}</dd></dl></section>
    </div></>);
}
