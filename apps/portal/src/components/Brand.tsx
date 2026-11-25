import { markFor } from '@/lib/brands';

/** An unframed mark, vertically centred in a fixed-width slot so rows of different marks line up. `size` is the slot height. */
export function Brand({ name, label, size = 28, title }: { name: string; label?: string; size?: number; title?: boolean }) {
  const m = markFor(name, label); const w = Math.round(size * 1.7);
  const common = { className: 'mark', style: { width: w, height: size }, role: title ? ('img' as const) : undefined, 'aria-label': title ? (label ?? m.label) : undefined, 'aria-hidden': title ? undefined : (true as const) };
  if (m.kind === 'image') return <span {...common}><img src={m.src} alt="" style={{ height: Math.round(size * 0.78), width: 'auto', maxWidth: '100%' }} /></span>;
  if (m.kind === 'glyph') { const light = isLight(m.hex); return <span {...common}><svg viewBox={m.box.join(' ')} height={Math.round(size * 0.66)} style={{ maxWidth: '100%' }} fill={`#${light ? '1b2410' : m.hex}`} focusable="false"><path d={m.path} /></svg></span>; }
  const I = m.icon; return <span {...common}><I size={Math.round(size * 0.62)} strokeWidth={1.6} color="#53535b" aria-hidden /></span>;
}
function isLight(hex: string) { const n = parseInt(hex, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return 0.299 * r + 0.587 * g + 0.114 * b > 200; }

/** A row of method marks with their state, for "what customers can pay with". */
export function MethodRow({ items }: { items: { key: string; label: string; on: boolean; note?: string }[] }) {
  return (<ul className="methods">{items.map(i => (
    <li key={i.key} data-on={i.on}><Brand name={i.key} label={i.label} size={34} /><span className="mname"><b>{i.label}</b><span>{i.note ?? (i.on ? 'On' : 'Off')}</span></span><span className={`dot ${i.on ? 'on' : ''}`} aria-hidden /><span className="sr">{i.on ? 'enabled' : 'not enabled'}</span></li>))}</ul>);
}

const NAME: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', applepay: 'Apple Pay', googlepay: 'Google Pay', link: 'Link' };
/** "Visa ···· 4242", with the wallet mark first when one was used. */
export function PayMethod({ m, compact }: { m?: { brand: string; last4: string; wallet?: string }; compact?: boolean }) {
  if (!m) return <span className="muted">Not recorded</span>;
  return (<span className="pm"><Brand name={m.wallet ?? m.brand} label={NAME[m.wallet ?? m.brand]} size={compact ? 22 : 26} title />{!compact && m.wallet && <Brand name={m.brand} label={NAME[m.brand]} size={26} title />}<span className="mono pmtxt">{compact ? `···· ${m.last4}` : `${NAME[m.brand]} ···· ${m.last4}`}</span></span>);
}
