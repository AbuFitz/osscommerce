import { notFound } from 'next/navigation';
import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { EditVariants } from '@/components/Variants';
import { ProductForm } from '@/components/product/ProductForm';
export const metadata = { title: 'Product' };
const tone = { published: 'ok', draft: 'warn', archived: '' } as const; const label = { published: 'Published', draft: 'Draft', archived: 'Archived' } as const;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = await gateway().product(id); if (!p) notFound();
  return (<><Header title={p.title} back={{ href: '/products', label: 'Products' }}><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span></Header>
    <ProductForm product={p} />
    <section className="w" style={{ marginTop: 16 }} aria-labelledby="vr"><div className="wh"><h2 id="vr">Variants, prices and stock</h2><EditVariants product={p} /></div>
      {p.optionGroups.length > 0 && <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Customers choose: {p.optionGroups.map(g => `${g.name} (${g.options.join(', ')})`).join(' and ')}</p>}
      <div className="vtable" role="table" aria-label="Variants"><div className="vth" role="row"><span role="columnheader">Variant</span><span role="columnheader">SKU</span><span role="columnheader" className="r">Price</span><span role="columnheader" className="r">Available</span><span role="columnheader">VAT</span></div>
        {p.variantList.map(v => (<div className={`vtr${v.enabled ? '' : ' off'}`} role="row" key={v.id}><span role="cell"><b>{v.options.length ? v.options.join(' · ') : 'Default'}</b>{!v.enabled && <span className="badge"> Off sale</span>}</span><span role="cell" className="mono">{v.sku}</span><span role="cell" className="r num">{v.compareAtMinor ? <s className="muted" style={{ marginRight: 6 }}>{money(v.compareAtMinor)}</s> : null}{money(v.priceMinor)}</span><span role="cell" className="r num">{v.onHand - v.allocated}<small className="muted"> of {v.onHand}</small></span><span role="cell" className="muted">{({ standard: '20%', reduced: '5%', zero: '0%' } as const)[v.taxClass]}</span></div>))}</div></section></>);
}
