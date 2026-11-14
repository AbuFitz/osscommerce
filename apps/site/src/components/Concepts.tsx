/**
 * Storefront concept mock-ups, drawn in CSS with abstract geometry. Deliberately not product photography:
 * they show layout, type and mood, not merchandise. Sized in container units so they scale as one picture.
 */
type V = 'editorial' | 'bold' | 'calm';
const P: Record<V, { bg: string; ink: string; a: string; b: string; c: string; w: number; up: boolean; r: string }> = {
  editorial: { bg: '#f4efe6', ink: '#1c1a17', a: '#b4472d', b: '#d9c7a8', c: '#2f4a3a', w: 350, up: false, r: '999px 999px 0 0' },
  bold: { bg: '#e4f55e', ink: '#101010', a: '#101010', b: '#ffffff', c: '#ff6a3d', w: 800, up: true, r: '50%' },
  calm: { bg: '#e9eef6', ink: '#1b2a3a', a: '#8fb0dc', b: '#ffffff', c: '#cfc2f3', w: 450, up: false, r: '40% 60% 55% 45% / 55% 45% 60% 40%' },
};
const NAMES: Record<V, { brand: string; h: string; sub: string; items: [string, string][] }> = {
  editorial: { brand: 'Atelier', h: 'Made slowly, kept for years.', sub: 'Small batches. Honest materials.', items: [['Object 01', '£48'], ['Object 02', '£36'], ['Object 03', '£64']] },
  bold: { brand: 'LOUD', h: 'BIG IDEAS. FEW UNITS.', sub: 'Drops every month.', items: [['Drop 01', '£30'], ['Drop 02', '£42'], ['Drop 03', '£25']] },
  calm: { brand: 'Soft Studio', h: 'Quiet things for a quieter home.', sub: 'Free UK delivery over £50.', items: [['Piece 01', '£28'], ['Piece 02', '£54'], ['Piece 03', '£40']] },
};

function Shape({ v, i }: { v: V; i: number }) {
  const c = P[v];
  const fills = [c.a, c.c, c.b];
  const radius = [c.r, '22%', '999px'][i % 3];
  return <div style={{ aspectRatio: '1', borderRadius: radius, background: `linear-gradient(145deg, ${fills[i % 3]}, ${i % 2 ? c.b : c.a})`, boxShadow: 'inset 0 -4cqw 6cqw rgba(0,0,0,.08)' }} />;
}

export function Concept({ v }: { v: V }) {
  const c = P[v], n = NAMES[v];
  const font = { fontWeight: c.w, textTransform: c.up ? ('uppercase' as const) : undefined };
  return (
    <div className="concept" style={{ background: c.bg, color: c.ink }} role="img" aria-label={`${v} storefront concept: ${n.h}`}>
      <div style={{ padding: '3.4cqw 4.4cqw', fontSize: '2.4cqw', display: 'grid', gap: '3.6cqw', aspectRatio: '4 / 3', alignContent: 'start', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ ...font, fontSize: '3.2cqw', letterSpacing: '-.04em' }}>{n.brand}</b>
          <span style={{ display: 'flex', gap: '3cqw', opacity: .75 }}><span>Shop</span><span>Story</span><span>Basket (2)</span></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: '4cqw', alignItems: 'center' }}>
          <div>
            <div style={{ ...font, fontSize: '7.4cqw', lineHeight: 1, letterSpacing: '-.05em' }}>{n.h}</div>
            <div style={{ margin: '2cqw 0 3cqw', opacity: .75, fontSize: '2.4cqw' }}>{n.sub}</div>
            <span style={{ display: 'inline-block', padding: '1.5cqw 3.6cqw', borderRadius: 999, background: c.ink, color: c.bg, fontWeight: 600 }}>Shop now</span>
          </div>
          <div style={{ position: 'relative', aspectRatio: '1' }}>
            <div style={{ position: 'absolute', inset: '8% 14% 0 0', borderRadius: c.r, background: `linear-gradient(160deg, ${c.a}, ${c.c})` }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: '46%', aspectRatio: '1', borderRadius: '50%', background: c.b, opacity: .92 }} />
            <div style={{ position: 'absolute', left: '6%', bottom: '4%', width: '40%', height: '16%', borderRadius: 999, background: c.ink, opacity: .85 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3cqw' }}>
          {n.items.map(([name, price], i) => (
            <div key={name}><Shape v={v} i={i} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.4cqw', ...(c.up ? { textTransform: 'uppercase', fontWeight: 700 } : {}) }}><span>{name}</span><span>{price}</span></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
