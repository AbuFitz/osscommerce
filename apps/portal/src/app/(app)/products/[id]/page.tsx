import { notFound } from 'next/navigation';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { PhotoManager } from '@/components/PhotoManager';
import { EditVariants } from '@/components/Variants';
import { photoStore, callerNow } from '@/lib/handoff';
export const metadata = { title: 'Product' };
const tone = { published: 'ok', draft: 'warn', archived: '' } as const; const label = { published: 'Published', draft: 'Draft', archived: 'Archived' } as const;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = await gateway().product(id); if (!p) notFound();
  const photos = photoStore().list((await callerNow()).storeId, p.id);
  return (<><Header title={p.title} back={{ href: '/products', label: 'Products' }}><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span></Header>
    <div className="grid">
      <section className="w c-8" aria-labelledby="ph"><div className="wh"><h2 id="ph">Photos</h2></div><PhotoManager productId={p.id} title={p.title} coverUrl={p.imageUrl} initial={photos} /></section>
      <section className="w c-12" aria-labelledby="vr"><div className="wh"><h2 id="vr">Variants</h2><EditVariants product={p} /></div>
        {p.optionGroups.length > 0 && <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Customers choose: {p.optionGroups.map(g => `${g.name} (${g.options.join(', ')})`).join(' and ')}</p>}
        <div className="vtable" role="table" aria-label="Variants"><div className="vth" role="row"><span role="columnheader">Variant</span><span role="columnheader">SKU</span><span role="columnheader" className="r">Price</span><span role="columnheader" className="r">Available</span><span role="columnheader">VAT</span></div>
          {p.variantList.map(v => (<div className={`vtr${v.enabled ? '' : ' off'}`} role="row" key={v.id}><span role="cell"><b>{v.options.length ? v.options.join(' · ') : 'Default'}</b>{!v.enabled && <span className="badge"> Off sale</span>}</span><span role="cell" className="mono">{v.sku}</span><span role="cell" className="r num">{money(v.priceMinor)}</span><span role="cell" className="r num">{v.onHand - v.allocated}<small className="muted"> of {v.onHand}</small></span><span role="cell" className="muted">{({ standard: '20%', reduced: '5%', zero: '0%' } as const)[v.taxClass]}</span></div>))}</div></section>
      <section className="w c-4" aria-labelledby="dt"><div className="wh"><h2 id="dt">Details</h2></div>
        <dl className="kv"><dt>Price</dt><dd className="num">{money(p.priceMinor)}</dd><dt>SKU</dt><dd className="mono">{p.sku}</dd><dt>Variants</dt><dd className="num">{p.variantList.length}</dd><dt>In stock</dt><dd className="num">{p.onHand}</dd></dl></section>
    </div></>);
}
