import { svgPathBbox } from 'svg-path-bbox';
import { siApplepay, siGooglepay, siStripe, siKlarna, siMeilisearch, siCloudinary, siResend, siDpd, siDhl, siMaplibre, siOpenstreetmap } from 'simple-icons';
import { Package, Mail, Map, Search, type LucideIcon } from 'lucide-react';
import { CARD_LOGOS } from './marks';

/** What to draw for a payment method or provider. No frames: a mark is shown as itself.
 *  1. Card brands and PayPal: the full-colour logos from the `payment-icons` set.
 *  2. Apple Pay, Google Pay, Klarna and provider marks: simple-icons glyphs (icon artwork CC0), cropped to their real extent and drawn in the brand colour.
 *  3. Provider artwork from official websites; generic icons only for non-brand features.
 *  Trademarks belong to their owners. These marks identify a method on the merchant's own screens; shoppers see Stripe's official marks in the Payment Element. */
export type Mark = { kind: 'image'; src: string; label: string } | { kind: 'glyph'; path: string; hex: string; box: [number, number, number, number]; label: string } | { kind: 'icon'; icon: LucideIcon; label: string };
const glyph = (label: string, i: { path: string; hex: string }): Mark => { const [x0, y0, x1, y1] = svgPathBbox(i.path); return { kind: 'glyph', label, path: i.path, hex: i.hex, box: [x0, y0, x1 - x0, y1 - y0] }; };
const img = (label: string, key: string): Mark => ({ kind: 'image', label, src: CARD_LOGOS[key] });
const provider = (label: string, src: string): Mark => ({ kind: 'image', label, src });
const icon = (label: string, i: LucideIcon): Mark => ({ kind: 'icon', label, icon: i });

export const MARKS: Record<string, Mark> = {
  visa: img('Visa', 'visa'), mastercard: img('Mastercard', 'mastercard'), amex: img('American Express', 'amex'), paypal: img('PayPal', 'paypal'),
  applepay: glyph('Apple Pay', siApplepay), googlepay: glyph('Google Pay', siGooglepay), klarna: glyph('Klarna', siKlarna), stripe: glyph('Stripe', siStripe),
  link: provider('Link', '/brands/link.svg'), clearpay: provider('Clearpay', '/brands/clearpay.svg'),
  meilisearch: glyph('Meilisearch', siMeilisearch), cloudinary: glyph('Cloudinary', siCloudinary), resend: glyph('Resend', siResend), dpd: glyph('DPD', siDpd), dhl: glyph('DHL', siDhl), maplibre: glyph('MapLibre', siMaplibre), openstreetmap: glyph('OpenStreetMap', siOpenstreetmap),
  royalmail: provider('Royal Mail', 'https://www.royalmail.com/themes/custom/rmlcwr/rmg_logo.svg'), shipstation: provider('ShipStation', 'https://www.shipstation.com/wp-content/uploads/2026/02/logo-ss-primary-rgb-1-1.svg'), shipbob: provider('ShipBob', '/brands/shipbob.svg'), postcodes: provider('Postcodes.io', '/brands/postcodes.svg'), idealpostcodes: provider('Ideal Postcodes', '/brands/idealpostcodes.svg'),
  printful: provider('Printful', 'https://static.cdn.printful.com/static/v882/images/layout/printful_logo.svg'), printify: provider('Printify', 'https://cdn.builder.io/api/v1/image/assets%2F445e727eb7d643c69181cc35b30462db%2F9d48e4c0c47d4ab8b4db739d7a1730aa'), gs1: provider('GS1', 'https://www.gs1uk.org/themes/custom/gs1uk_rebuild/gs1uk-logo.svg'), search: icon('Search', Search), email: icon('Email', Mail), maps: icon('Maps', Map),
};
export const markFor = (key: string, label?: string): Mark => MARKS[key] ?? icon(label ?? key, Package);
