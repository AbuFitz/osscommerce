# What Vendure already does, and what we build

Sources read (Nov 2026): Vendure docs on stock control, promotions, core plugins, the plugin guide, the multi-vendor guide, and a search of the plugin ecosystem. Rule: configure what Vendure has; build only the gap, and build it as a small plugin.

## Already in Vendure: configure, do not rebuild
| Need | What Vendure provides | State here |
|---|---|---|
| Stock counts, allocation, history | `stockOnHand`, `allocated`, saleable = on hand - allocated - out-of-stock threshold. Stock is allocated when payment is authorised/settled and converted to a sale on fulfilment. Every change is a `StockMovement` (Allocation, Sale, Cancellation, Release, StockAdjustment) | In use. Orders and fulfilment already drive it |
| Back orders ("keep selling when out of stock") | Negative `outOfStockThreshold`, per variant or global | Not yet exposed in the portal |
| Shopper stock wording | `StockDisplayStrategy` (in stock / low / out) | **Configured now:** level set by `LOW_STOCK_AT` (default 5) instead of Vendure's fixed 10; the exact count is never shown |
| Multiple stock locations | `StockLocation` + `StockLocationStrategy` | One location per store already created at provisioning |
| Discounts | Promotions: conditions and actions, coupon codes, usage limits, per-customer limits, free shipping, order and line discounts, "buy X get Y free", free gift via `onActivate` | Backend ready; portal Discounts page still shows an honest empty state |
| Delivery pricing | Shipping eligibility checkers and calculators | One flat-rate method per store; postcode/weight/value rules are custom checkers (small) |
| Background work | Job queue (Postgres-backed here), scheduler | In use |
| Email | `EmailPlugin` (templates, events) | Our own automation + Resend layer is planned instead, to keep one audited sender |
| Search | `DefaultSearchPlugin`; Elasticsearch plugin exists for large catalogues | Default in use; revisit at scale |

## Not in Vendure core (as far as the docs read show): build, or adopt a community plugin after review
| Need | Position |
|---|---|
| Packs and singles, automatic pack opening | Not found in core. Built the rules in `packages/inventory` (tested). Next: a Vendure plugin that applies them from stock events |
| Wishlists, reviews, loyalty, gift cards | The plugin guide names them as typical plugins; a community wishlist plugin exists. Review licence, maintenance and tenancy behaviour before adopting any; otherwise build small |
| Subscriptions / repeat orders | Build (schedule + payment method on file via Stripe) |
| Trade pricing, company accounts, quotes | Vendure's paid plans include B2B; core has customer groups and price-by-group building blocks. Build the simple version (customer group prices) |
| Multi-vendor | Vendure ships an example plugin. We use one store per channel instead, so this is not needed |

## Build order (each ships with a default and one switch)
1. Packs/singles plugin, using `StockMovementEvent` and a per-variant "sold as" field; idempotent per order event; proof against the dev cell.
2. Portal controls for what Vendure already has: back orders, low-stock level, discounts (promotions), delivery rules.
3. Days-of-stock-left alerts and reorder suggestions (from stock movements).
4. Automation actions beyond email (hide when out, back-in-stock signup, discount slow stock).
5. Made-to-order options, subscriptions, trade pricing.
