# Icon and mark sources

- **UI icons**: `lucide-react` 1.x (ISC). One stroke weight (1.75) applied globally.
- **Brand glyphs** (Apple Pay, Google Pay, Klarna, Stripe, Meilisearch, Cloudinary, Resend, DPD, DHL, MapLibre, OpenStreetMap): `simple-icons` 16.x (icon artwork CC0). Cropped to their real extent and drawn without a frame in the brand colour (ink where the brand colour is too light to read).
- **Card and PayPal logos** (Visa, Mastercard, American Express, PayPal): the `payment-icons` package, "single" set (MPL-2.0). Files are embedded unmodified apart from removing editor metadata (`apps/portal/scripts/gen-marks.py`). If you modify these files, MPL-2.0 requires the changed files to stay under MPL-2.0.
- Where no mark exists (Link, Clearpay, Royal Mail, ShipStation, ShipBob, Postcodes.io, Ideal Postcodes, Printful, Printify, GS1) a plain category icon is shown beside the name. No logo is invented.
- Trademarks belong to their owners. These marks identify methods on the merchant's own screens; shoppers see Stripe's official marks in the Payment Element. Apple Pay, Visa and Mastercard have their own brand-usage rules for any shopper-facing use.
