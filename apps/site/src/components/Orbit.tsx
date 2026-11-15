import { Mark, type MarkKey } from './Marks';
const RING: MarkKey[] = ['visa', 'mastercard', 'amex', 'applepay', 'googlepay', 'stripe'];
/** Payment methods circling the brand. They turn slowly; under reduced motion they sit still. */
export function Orbit() {
  return (<div className="orbit" role="img" aria-label="Payment methods accepted through OneSimpleCommerce: Visa, Mastercard, American Express, Apple Pay and Google Pay, processed by Stripe">
    <div className="orbit-ring" aria-hidden>{RING.map((k, i) => <span key={k} style={{ ['--a' as string]: `${(360 / RING.length) * i}deg` }}><i><Mark k={k} /></i></span>)}</div>
    <div className="orbit-core" aria-hidden><b>osc<em>.</em></b></div>
  </div>);
}
