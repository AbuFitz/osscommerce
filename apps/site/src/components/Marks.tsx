import { siVisa, siMastercard, siApplepay, siGooglepay, siStripe, siKlarna, siAmericanexpress, type SimpleIcon } from 'simple-icons';

/** Brand glyphs from the simple-icons set (icon artwork CC0; trademarks belong to their owners). They identify a method; they do not imply partnership. */
const SET = { visa: siVisa, mastercard: siMastercard, amex: siAmericanexpress, applepay: siApplepay, googlepay: siGooglepay, stripe: siStripe, klarna: siKlarna } satisfies Record<string, SimpleIcon>;
export type MarkKey = keyof typeof SET;
export function Mark({ k, mono }: { k: MarkKey; mono?: boolean }) {
  const i = SET[k];
  return <svg className="mk" viewBox="0 0 24 24" role="img" aria-label={i.title} fill={mono ? 'currentColor' : `#${i.hex === 'FFFFFF' || i.hex === '000000' ? '0e1311' : i.hex}`}><path d={i.path} /></svg>;
}
