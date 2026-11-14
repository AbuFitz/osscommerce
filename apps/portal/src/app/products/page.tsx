import { gateway } from '@/lib/gateway-instance';
import { money } from '@/lib/format';
import { Header } from '@/components/ui';
import { Tile } from '@/components/art';
export const metadata = { title: 'Products' };
const tone = { published: 'ok', draft: 'warn', archived: '' } as const;
const label = { published: 'Published', draft: 'Draft', archived: 'Archived' } as const;

export default async function Products() {
  const ps = await gateway().products();
  return (<>
    <Header title="Products" eyebrow={`${ps.filter(p => p.status === 'published').length} published · ${ps.filter(p => p.status === 'draft').length} draft`}>
      <button className="btn" type="button">Import CSV</button><button className="btn primary" type="button">Add product</button></Header>
    <div className="pgrid">{ps.map(p => { const avail = p.onHand - p.allocated; return (
      <article key={p.id} className="w" style={{ padding: 12 }}>
        <Tile seed={p.sku} label={p.title} />
        <div style={{ padding: '12px 6px 6px' }}>
          <b style={{ fontWeight: 600 }}>{p.title}</b>
          <div className="muted mono" style={{ marginTop: 2 }}>{p.sku} · {p.variants} variant{p.variants > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span className="num" style={{ fontSize: 18 }}>{money(p.priceMinor)}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className={`badge ${tone[p.status]}`}>{label[p.status]}</span></span>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{p.status === 'published' ? `${avail} available` : 'Not on sale'}</div>
        </div>
      </article>); })}</div></>);
}
