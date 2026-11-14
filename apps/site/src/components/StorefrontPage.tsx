/**
 * Concept storefront pages. Sized in container units (cqw) so one design scales from a phone to a wide panel.
 * Imagery is 3D studio renders, labelled as concepts. Names are invented and do not refer to real businesses.
 */
export type Variant = 'ceramics' | 'apothecary' | 'coffee' | 'audio' | 'stationery';
type T = { brand: string; nav: string[]; h: string; sub: string; cta: string; bg: string; ink: string; accent: string; card: string; layout: 'split' | 'full' | 'grid'; weight: number; upper?: boolean; items: [string, string][] };
export const CONCEPTS: Record<Variant, T & { industry: string }> = {
  ceramics: { industry: 'Homeware and ceramics', brand: 'Orrin', nav: ['Shop', 'Collections', 'Studio', 'Journal'], h: 'Made by hand, slowly.', sub: 'Small-batch ceramics, glazed in the studio and shipped across the UK.', cta: 'Shop the collection', bg: '#f3eadb', ink: '#26201a', accent: '#c4623a', card: '#ece0cc', layout: 'split', weight: 400, items: [['Terra vase', '£58'], ['Chalk vase', '£42'], ['Sage bowl', '£34']] },
  apothecary: { industry: 'Skincare and botanicals', brand: 'Fenwick', nav: ['Skincare', 'Body', 'Gifts', 'About'], h: 'Plant-led care, kept simple.', sub: 'Everyday formulas in refillable glass. Free delivery over £40.', cta: 'Find your routine', bg: '#e8eee8', ink: '#16231b', accent: '#2f6b4a', card: '#dbe5dc', layout: 'full', weight: 500, items: [['Amber oil', '£26'], ['Balm jar', '£22'], ['Mist', '£18']] },
  coffee: { industry: 'Coffee roaster', brand: 'TAMSIN', nav: ['Coffee', 'Subscribe', 'Equipment', 'Wholesale'], h: 'Roasted this week. At your door by Friday.', sub: 'Single-origin beans, roasted to order in small batches.', cta: 'Start a subscription', bg: '#1b1410', ink: '#f3e9dc', accent: '#d9964f', card: '#2a1f18', layout: 'split', weight: 700, upper: true, items: [['Ethiopia · 250g', '£11'], ['House blend · 1kg', '£34'], ['Tin · 250g', '£14']] },
  audio: { industry: 'Audio and gadgets', brand: 'lumen', nav: ['Speakers', 'Accessories', 'Support', 'Trade-in'], h: 'Room-filling sound. Pocket-sized price.', sub: 'Compact speakers with a two-year warranty and free UK returns.', cta: 'Compare models', bg: '#e3e9f1', ink: '#101822', accent: '#2a5bd7', card: '#d3dce9', layout: 'grid', weight: 600, items: [['Lumen One', '£129'], ['Lumen Mini', '£79'], ['Stand', '£24']] },
  stationery: { industry: 'Stationery and gifts', brand: 'Paper & Pine', nav: ['Notebooks', 'Desk', 'Gifts', 'Sale'], h: 'Notebooks that earn their desk space.', sub: 'Lay-flat, thick paper, made in small runs.', cta: 'Shop notebooks', bg: '#f7efdc', ink: '#2b2a20', accent: '#b4472d', card: '#eee1c4', layout: 'full', weight: 600, items: [['A5 set of 3', '£24'], ['Pocket pair', '£12'], ['Desk pen', '£16']] },
};
const crop = (v: Variant, i: number): React.CSSProperties => ({ backgroundImage: `url(/renders/${v}.jpg)`, backgroundSize: '190% auto', backgroundPosition: ['4% 72%', '50% 72%', '96% 72%'][i], backgroundRepeat: 'no-repeat' });

export function StorefrontPage({ v, mobile = false }: { v: Variant; mobile?: boolean }) {
  const t = CONCEPTS[v];
  const up = t.upper ? { textTransform: 'uppercase' as const } : undefined;
  const display = { fontWeight: t.weight, letterSpacing: '-.045em', lineHeight: 1.02, ...up };
  const btn = { display: 'inline-block', padding: '.9cqw 2.2cqw', borderRadius: 999, background: t.ink, color: t.bg, fontWeight: 600, fontSize: '1.25cqw' } as const;
  if (mobile) return (
    <div style={{ containerType: 'inline-size', width: '100%', height: '100%', overflow: 'hidden' }} aria-hidden><div style={{ background: t.bg, color: t.ink, width: '100%', height: '100%', fontSize: '4cqw' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5cqw 6cqw', alignItems: 'center' }}><b style={{ fontSize: '5.6cqw', letterSpacing: '-.04em', ...up }}>{t.brand}</b><span style={{ opacity: .7 }}>Bag (2)</span></div>
      <div style={{ padding: '2cqw 6cqw 4cqw' }}><div style={{ ...display, fontSize: '11cqw' }}>{t.h}</div><div style={{ margin: '3cqw 0 4cqw', opacity: .75, fontSize: '4.2cqw', lineHeight: 1.4 }}>{t.sub}</div><span style={{ display: 'inline-block', padding: '3cqw 6cqw', borderRadius: 99, background: t.ink, color: t.bg, fontWeight: 600 }}>{t.cta}</span></div>
      <div style={{ margin: '0 6cqw', aspectRatio: '4 / 3', borderRadius: '5cqw', backgroundImage: `url(/renders/${v}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3cqw', padding: '5cqw 6cqw' }}>{t.items.slice(0, 2).map(([n, p], i) => <div key={n}><div style={{ ...crop(v, i), aspectRatio: '1', borderRadius: '4cqw', backgroundColor: t.card }} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2cqw', fontSize: '3.6cqw' }}><span>{n}</span><b>{p}</b></div></div>)}</div>
    </div></div>);
  return (
    <div style={{ containerType: 'inline-size', width: '100%', aspectRatio: '16 / 10', overflow: 'hidden', position: 'relative' }} role="img" aria-label={`${t.industry} storefront concept: ${t.h}`}><div style={{ background: t.bg, color: t.ink, width: '100%', height: '100%', fontSize: '1.3cqw' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.8cqw 3.4cqw' }}>
        <b style={{ fontSize: '2cqw', letterSpacing: '-.04em', ...up }}>{t.brand}</b>
        <span style={{ display: 'flex', gap: '2.6cqw', opacity: .75 }}>{t.nav.map(n => <span key={n}>{n}</span>)}</span>
        <span style={{ opacity: .85 }}>Search · Account · Bag (2)</span>
      </div>
      {t.layout === 'split' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: '2.4cqw', padding: '1cqw 3.4cqw 2cqw', alignItems: 'center' }}>
          <div><div style={{ ...display, fontSize: '5.2cqw' }}>{t.h}</div><div style={{ margin: '1.6cqw 0 2.2cqw', opacity: .75, fontSize: '1.4cqw', maxWidth: '30cqw', lineHeight: 1.45 }}>{t.sub}</div><span style={btn}>{t.cta}</span></div>
          <div style={{ aspectRatio: '4 / 3', borderRadius: '2cqw', backgroundImage: `url(/renders/${v}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 2cqw 4cqw -2cqw rgba(0,0,0,.35)' }} />
        </div>)}
      {t.layout === 'full' && (
        <div style={{ position: 'relative', margin: '0 3.4cqw', borderRadius: '2cqw', overflow: 'hidden', aspectRatio: '16 / 7.2', backgroundImage: `url(/renders/${v}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 60%' }}>
          <div style={{ position: 'absolute', left: '2.4cqw', top: '2.4cqw', maxWidth: '26cqw' }}><div style={{ ...display, fontSize: '4.2cqw' }}>{t.h}</div><div style={{ margin: '1.2cqw 0 1.8cqw', opacity: .8, fontSize: '1.3cqw', lineHeight: 1.4 }}>{t.sub}</div><span style={btn}>{t.cta}</span></div>
        </div>)}
      {t.layout === 'grid' && (
        <div style={{ padding: '.5cqw 3.4cqw 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '1.6cqw' }}><div style={{ ...display, fontSize: '4.4cqw', maxWidth: '36cqw' }}>{t.h}</div><span style={btn}>{t.cta}</span></div>
          <div style={{ borderRadius: '2cqw', aspectRatio: '16 / 5', backgroundImage: `url(/renders/${v}.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center 55%' }} /></div>)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.6cqw', padding: '1.6cqw 3.4cqw 0' }}>
        {t.items.map(([n, p], i) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '5.6cqw 1fr auto', gap: '1.2cqw', alignItems: 'center', padding: '.9cqw', borderRadius: '1.4cqw', background: t.card }}>
            <div style={{ ...crop(v, i), aspectRatio: '1', borderRadius: '1cqw', backgroundColor: t.bg }} /><span style={{ fontWeight: 560 }}>{n}</span><b>{p}</b></div>))}
      </div>
    </div></div>
  );
}
