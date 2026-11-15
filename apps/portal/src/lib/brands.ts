import { svgPathBbox } from 'svg-path-bbox';
import { siApplepay, siGooglepay, siStripe, siKlarna, siMeilisearch, siCloudinary, siResend, siDpd, siDhl, siMaplibre, siOpenstreetmap } from 'simple-icons';
import { Truck, MapPin, Shirt, Barcode, Package, Mail, Map, Search, Receipt, CreditCard, type LucideIcon } from 'lucide-react';
import { CARD_LOGOS } from './marks';

/** What to draw for a payment method or provider. No frames: a mark is shown as itself.
 *  1. Card brands and PayPal: the full-colour logos from the `payment-icons` set.
 *  2. Apple Pay, Google Pay, Klarna and provider marks: simple-icons glyphs (icon artwork CC0), cropped to their real extent and drawn in the brand colour.
 *  3. No mark exists (Link, Clearpay, Royal Mail, ShipStation, ...): a plain category icon beside the name, never an invented logo.
 *  Trademarks belong to their owners. These marks identify a method on the merchant's own screens; shoppers see Stripe's official marks in the Payment Element. */
export type Mark = { kind: 'image'; src: string; label: string } | { kind: 'glyph'; path: string; hex: string; box: [number, number, number, number]; label: string } | { kind: 'icon'; icon: LucideIcon; label: string };
const glyph = (label: string, i: { path: string; hex: string }): Mark => { const [x0, y0, x1, y1] = svgPathBbox(i.path); return { kind: 'glyph', label, path: i.path, hex: i.hex, box: [x0, y0, x1 - x0, y1 - y0] }; };
const img = (label: string, key: string): Mark => ({ kind: 'image', label, src: CARD_LOGOS[key] });
const icon = (label: string, i: LucideIcon): Mark => ({ kind: 'icon', label, icon: i });

export const MARKS: Record<string, Mark> = {
  visa: img('Visa', 'visa'), mastercard: img('Mastercard', 'mastercard'), amex: img('American Express', 'amex'), paypal: img('PayPal', 'paypal'),
  applepay: glyph('Apple Pay', siApplepay), googlepay: glyph('Google Pay', siGooglepay), klarna: glyph('Klarna', siKlarna), stripe: glyph('Stripe', siStripe),
  link: icon('Link', CreditCard), clearpay: icon('Clearpay', Receipt),
  meilisearch: glyph('Meilisearch', siMeilisearch), cloudinary: glyph('Cloudinary', siCloudinary), resend: glyph('Resend', siResend), dpd: glyph('DPD', siDpd), dhl: glyph('DHL', siDhl), maplibre: glyph('MapLibre', siMaplibre), openstreetmap: glyph('OpenStreetMap', siOpenstreetmap),
  royalmail: icon('Royal Mail', Truck), shipstation: icon('ShipStation', Truck), shipbob: icon('ShipBob', Package), postcodes: icon('Postcodes.io', MapPin), idealpostcodes: icon('Ideal Postcodes', MapPin),
  printful: icon('Printful', Shirt), printify: icon('Printify', Shirt), gs1: icon('GS1', Barcode), search: icon('Search', Search), email: icon('Email', Mail), maps: icon('Maps', Map),
};
export const markFor = (key: string, label?: string): Mark => MARKS[key] ?? icon(label ?? key, Package);
