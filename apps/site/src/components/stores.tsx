import { Search, ShoppingBag } from 'lucide-react';

type A = { a: string; b: string; c: string };
/** Product artwork drawn in code (no stock photography, no invented product shots). Each takes the store's own colours. */
export const ART = {
  bag: ({ a, b, c }: A) => (<svg viewBox="0 0 120 150" aria-hidden><path d="M26 28h68l8 108H18z" fill={a}/><path d="M26 28h68l3 18H23z" fill={c} opacity=".35"/><rect x="38" y="62" width="44" height="46" rx="4" fill={b}/><circle cx="60" cy="85" r="10" fill={a}/><path d="M26 28 34 14h52l8 14" fill="none" stroke={c} strokeWidth="3"/></svg>),
  tee: ({ a, b }: A) => (<svg viewBox="0 0 140 130" aria-hidden><path d="M44 10 20 26 6 54l22 10 8-12v68h68V52l8 12 22-10-14-28L96 10c-4 10-12 16-26 16S48 20 44 10z" fill={a}/><path d="M52 10c4 8 10 12 18 12s14-4 18-12" fill="none" stroke={b} strokeWidth="4"/><rect x="52" y="60" width="36" height="8" fill={b}/></svg>),
  hood: ({ a, b }: A) => (<svg viewBox="0 0 140 140" aria-hidden><path d="M46 8c8 8 16 12 24 12S86 16 94 8l30 18 12 40-18 8-6-12v70H28V62l-6 12-18-8 12-40z" fill={a}/><path d="M50 12c4 14 10 20 20 20s16-6 20-20" fill="none" stroke={b} strokeWidth="4"/><rect x="50" y="86" width="40" height="22" rx="4" fill={b} opacity=".4"/></svg>),
  cap: ({ a, b }: A) => (<svg viewBox="0 0 140 100" aria-hidden><path d="M20 70c0-30 22-50 50-50s50 20 50 50z" fill={a}/><path d="M16 70h108c0 10-20 14-54 14S16 80 16 70z" fill={b}/><circle cx="70" cy="22" r="5" fill={b}/></svg>),
  loaf: ({ a, b, c }: A) => (<svg viewBox="0 0 150 110" aria-hidden><ellipse cx="75" cy="64" rx="64" ry="38" fill={a}/><path d="M38 52q18-14 24 6M66 44q18-14 24 6M94 52q18-14 24 6" fill="none" stroke={b} strokeWidth="5" strokeLinecap="round"/><ellipse cx="75" cy="64" rx="64" ry="38" fill="none" stroke={c} strokeWidth="3" opacity=".5"/></svg>),
  box: ({ a, b, c }: A) => (<svg viewBox="0 0 140 120" aria-hidden><path d="M14 40 70 18l56 22v62L70 118 14 102z" fill={a}/><path d="M14 40 70 62l56-22M70 62v56" fill="none" stroke={c} strokeWidth="3" opacity=".6"/><path d="M52 28l56 24" stroke={b} strokeWidth="9"/></svg>),
  jar: ({ a, b, c }: A) => (<svg viewBox="0 0 110 140" aria-hidden><path d="M60 8c8 10 8 16 0 24-8-8-8-14 0-24z" fill={c}/><rect x="20" y="40" width="70" height="84" rx="14" fill={a}/><rect x="20" y="40" width="70" height="14" rx="7" fill={b}/><rect x="32" y="70" width="46" height="34" rx="4" fill={b} opacity=".5"/><rect x="52" y="34" width="6" height="12" fill="#2a2018"/></svg>),
  bottle: ({ a, b, c }: A) => (<svg viewBox="0 0 90 150" aria-hidden><rect x="34" y="8" width="22" height="22" rx="4" fill={c}/><path d="M28 30h34v14l10 14v76a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V58l10-14z" fill={a}/><rect x="28" y="76" width="34" height="34" rx="4" fill={b}/></svg>),
} as const;
type ArtKey = keyof typeof ART;
export interface Store { id: string; label: string; name: string; url: string; kind: string; note: string; vars: Record<string, string>; links: string[]; head: string; sub: string; cta: string; hero: ArtKey; palette: A; products: { n: string; p: string; art: ArtKey; pal?: A }[] }

export const STORES: Store[] = [
  { id: 'roaster', label: 'Coffee roaster', name: 'Ember & Oak', url: 'emberandoak.co.uk', kind: 'Specialty coffee', note: 'Subscription-led, tasting notes on every bag, slow editorial pace.',
    vars: { '--bg': '#1c130d', '--fg': '#f3e6d3', '--ln': 'rgba(243,230,211,.16)', '--hero': 'linear-gradient(135deg,#3a2415,#1c130d 70%)', '--ac': '#e9a24d', '--acf': '#1c130d', '--card': '#2a1c12', '--sd': 'var(--fs)', '--slw': '500', '--sls': '-.02em', '--shw': '400', '--shs': '5.6cqw', '--sf': 'var(--ft)', '--sr': '99px', '--scr': '1.6cqw' },
    links: ['Coffee', 'Subscribe', 'Brew', 'Journal'], head: 'Roasted this week. At your door by Friday.', sub: 'Small-batch coffee, roasted to order.', cta: 'Shop beans', hero: 'bag', palette: { a: '#e9a24d', b: '#f3e6d3', c: '#7a4a24' },
    products: [{ n: 'Ethiopia Guji', p: '£11.50', art: 'bag' }, { n: 'Brazil Santos', p: '£9.50', art: 'bag', pal: { a: '#8fb08a', b: '#f3e6d3', c: '#3d5a39' } }, { n: 'Drip bag box', p: '£14.00', art: 'box', pal: { a: '#c97a4a', b: '#f3e6d3', c: '#e9a24d' } }] },
  { id: 'streetwear', label: 'Streetwear label', name: 'NORTHSIDE', url: 'northside.store', kind: 'Streetwear', note: 'Drop-based releases, sizes sell out, hard-edged and fast.',
    vars: { '--bg': '#f4f4f0', '--fg': '#0a0a0a', '--ln': '#0a0a0a', '--hero': '#d7ff3a', '--ac': '#0a0a0a', '--acf': '#d7ff3a', '--card': '#e6e6e0', '--sd': 'var(--fd)', '--slw': '800', '--sls': '.04em', '--stt': 'uppercase', '--shw': '800', '--shs': '6.8cqw', '--sf': 'var(--ft)', '--sr': '0', '--scr': '0' },
    links: ['Drop 07', 'Archive', 'Sizing', 'Stores'], head: 'Drop 07 lands Friday', sub: 'Boxy fits. Heavy cotton. Numbered runs.', cta: 'Get notified', hero: 'hood', palette: { a: '#0a0a0a', b: '#d7ff3a', c: '#0a0a0a' },
    products: [{ n: 'Boxy tee', p: '£38', art: 'tee', pal: { a: '#0a0a0a', b: '#d7ff3a', c: '#0a0a0a' } }, { n: 'Heavy hoodie', p: '£72', art: 'hood', pal: { a: '#6b6bff', b: '#f4f4f0', c: '#0a0a0a' } }, { n: 'Panel cap', p: '£28', art: 'cap', pal: { a: '#0a0a0a', b: '#f4f4f0', c: '#0a0a0a' } }] },
  { id: 'bakery', label: 'Bakery', name: 'Flour & Salt', url: 'flourandsalt.co.uk', kind: 'Artisan bakery', note: 'Pre-order slots, collection or local delivery, warm and rounded.',
    vars: { '--bg': '#fbf1e4', '--fg': '#3b2417', '--ln': 'rgba(59,36,23,.14)', '--hero': 'linear-gradient(135deg,#f6c9b1,#fbe3cf)', '--ac': '#3b2417', '--acf': '#fbf1e4', '--card': '#f4e1cb', '--sd': 'var(--fs)', '--slw': '600', '--sls': '-.02em', '--shw': '600', '--shs': '5.4cqw', '--sf': 'var(--ft)', '--sr': '99px', '--scr': '2.6cqw' },
    links: ['Bread', 'Pastry', 'Gift boxes', 'Collect'], head: 'Baked at dawn. Yours by lunch.', sub: 'Order by 6pm for tomorrow’s bake.', cta: 'Reserve a loaf', hero: 'loaf', palette: { a: '#c98440', b: '#f1c88a', c: '#8a5424' },
    products: [{ n: 'Sourdough', p: '£5.50', art: 'loaf' }, { n: 'Cardamom buns', p: '£12.00', art: 'box', pal: { a: '#e7a98c', b: '#fbf1e4', c: '#3b2417' } }, { n: 'Gift box', p: '£28.00', art: 'box', pal: { a: '#9bb89a', b: '#fbf1e4', c: '#3b2417' } }] },
  { id: 'candles', label: 'Candle brand', name: 'Wick & Wild', url: 'wickandwild.com', kind: 'Candles and fragrance', note: 'Quiet, tactile, made-to-order scents and personalised sets.',
    vars: { '--bg': '#e4eadb', '--fg': '#1f2a1c', '--ln': 'rgba(31,42,28,.16)', '--hero': 'linear-gradient(160deg,#c9d8b8,#e4eadb)', '--ac': '#1f2a1c', '--acf': '#e4eadb', '--card': '#d4dfc6', '--sd': 'var(--fs)', '--slw': '500', '--sls': '-.03em', '--shw': '400', '--shs': '5.8cqw', '--sf': 'var(--ft)', '--sr': '99px', '--scr': '1.6cqw' },
    links: ['Candles', 'Home scent', 'Create yours', 'About'], head: 'Scent, made for your space.', sub: 'Hand-poured. Made to order.', cta: 'Create yours', hero: 'jar', palette: { a: '#e8dcc4', b: '#9bb08a', c: '#d98a3d' },
    products: [{ n: 'Fig & cedar', p: '£26', art: 'jar' }, { n: 'Linen & rain', p: '£24', art: 'jar', pal: { a: '#cfd8e6', b: '#8aa0c4', c: '#d98a3d' } }, { n: 'Room mist', p: '£16', art: 'bottle', pal: { a: '#e8dcc4', b: '#9bb08a', c: '#1f2a1c' } }] },
];
const DEF: A = { a: '#999', b: '#555', c: '#333' };
/** A storefront drawn entirely in code. It stands for what we build: a different design for each business. */
export function StoreMock({ s }: { s: Store }) {
  const Hero = ART[s.hero];
  return (<div className="sm" style={s.vars as React.CSSProperties} role="img" aria-label={`${s.name}: a concept storefront for a ${s.kind.toLowerCase()} business, showing a hero banner and three products`}>
    <div className="sm-i" aria-hidden>
      <div className="sm-nav"><span className="sm-logo">{s.name}</span><span className="sm-l">{s.links.map(l => <i key={l} style={{ fontStyle: 'normal' }}>{l}</i>)}</span><span className="sm-ic"><Search /><ShoppingBag /></span></div>
      <div className="sm-m">
        <div className="sm-h"><div className="sm-art"><Hero {...s.palette} /></div><h4>{s.head}</h4><p>{s.sub}</p><span className="sm-b">{s.cta}</span></div>
        <div className="sm-g">{s.products.map(p => { const P = ART[p.art]; return (<div className="sm-c" key={p.n}><div className="sm-p"><P {...(p.pal ?? s.palette ?? DEF)} /></div><div><b>{p.n}</b><br /><span>{p.p}</span></div></div>); })}</div>
      </div>
    </div></div>);
}
