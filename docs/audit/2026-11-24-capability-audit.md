# Capability audit: what a merchant can actually do today

Method: introspected the live staging engine's Admin API (82 queries, 183 mutations), compared it with what the portal calls and with the tenant guard's merchant allowlist, read the portal's gateway interface and screens, and checked Vendure's documentation. Findings are facts from the code unless marked *(to confirm)*.

## 1. The headline numbers
| | Count |
|---|---|
| Admin API mutations the engine offers | 183 |
| Mutations the portal calls | 16 (several are operator set-up, not merchant features) |
| Mutations merchants are allowed to call (tenant guard) | 26 |
| Allowed, already safe, but **no screen uses them** | 13 |
| Queries offered / used by portal / allowed | 82 / 27 / 24 |

The 13 already-permitted-but-unused mutations are the cheapest wins, because they need UI only: `updateProduct`, `deleteProduct`, `deleteProductVariant`, `updateCollection`, `deleteCollection`, `createAssets`, `updateAsset`, `deleteAssets`, `cancelOrder`, `addNoteToOrder`, `updateCustomer`, `updatePromotion`, `deletePromotion`.

Consequence today: a merchant cannot edit a product's name or description, delete a product, edit or delete a collection or discount, cancel an order, or leave a note on an order.

## 2. Area by area
Legend: **Engine** = Vendure already provides it. **Guard** = blocked for merchants until we add ownership checks. **Build** = not in Vendure.

### Products
| Today | Missing | Source |
|---|---|---|
| Create takes title, price, SKU, stock, status. Variants and options editable. CSV import | Description (rich text), **images at creation**, compare-at price, cost, barcode, weight at product level, vendor, product type, tags, SEO title/description/URL, edit and delete, duplicate, bulk edit, archive, product-level stock history, sales channels, related products | Engine for all of these (`updateProduct`, `updateProducts`, assets, facets, tags, `duplicateEntity`, `stockMovements`). Guard for `updateProducts`, facets, tags, duplicate |
| Photos exist only on the product detail page, and in live mode they are demo-only ("available once your store is live") | Live upload into the engine's asset store (needs the R2 keys), reorder, set cover, alt text, crop | Engine: assets plus the asset-server image transforms |

Why you can't add an image when creating a product: the create form simply has no image field, and the photo manager is wired to a demo-only path. It is not handled separately by design; it is unfinished.

### Orders
| Today | Missing |
|---|---|
| List, filters, search, detail, fulfil with tracking, full and partial refund | Cancel, notes, **edit an order (add or remove items)**, create an order by hand (phone or in-person), resend confirmation, print packing slip or invoice, bulk fulfil, partial fulfilment per line, mark as paid (bank transfer), returns and exchanges, order tags, timeline of every change, export |

Vendure has the order lifecycle: AddingItems, ArrangingPayment, PaymentAuthorized/Settled, PartiallyShipped, Shipped, PartiallyDelivered, Delivered, Modifying, ArrangingAdditionalPayment, Cancelled; fulfilment and payment have their own states. Draft orders (`createDraftOrder` and friends), `modifyOrder`, `addManualPaymentToOrder`, `transitionOrderToState` all exist and are guard-blocked. Customer-facing return requests (RMA) are **Build**.

### Customers
| Today | Missing |
|---|---|
| List with order count and spend; export | Customer detail page, order history, addresses, notes, tags, **customer groups and segments**, marketing consent history, merge duplicates, create and import customers, lifetime value, last seen |

Engine: customer CRUD, addresses, notes, customer groups. Guard-blocked. Segments with live rules are **Build** (from orders).

### Discounts and promotions
| Today | Missing |
|---|---|
| Create code (percent, fixed, free shipping), minimum spend, limit, end date | Edit, pause, delete; **automatic discounts**; buy X get Y; free gift; product or collection scoped; customer-group scoped; per-customer limits; stacking rules; start date; usage report |

Engine: conditions and actions cover all of these (docs read). Only `createPromotion` is wired.

### Inventory
| Today | Missing |
|---|---|
| Per-product stock figure, set or add with a reason, low-stock level | Variant-level inventory table, stock history per variant, **multiple locations and transfers**, back orders (negative threshold), count mode, incoming stock and purchase orders, reorder suggestions, pack and single linking in the UI (engine side is built) |

Engine: stock locations, movements, thresholds. Locations are guard-blocked.

### Delivery, tax and payments
| Today | Missing |
|---|---|
| Flat-rate zones and rates, free-over amount. Payments page shows Stripe state | Weight, value and postcode-based rules, multiple carriers and live rates, label printing, delivery estimates, click-and-collect, local delivery, per-product shipping class, tax rates per region and per product class screen, tax-inclusive/exclusive display, payout and dispute list *(planned)* |

Engine: shipping eligibility checkers and calculators (custom ones are small), tax categories and rates. Carrier label APIs are **Build** or an integration.

### Storefront and content
| Today | Missing |
|---|---|
| Homepage sections, legal pages, preview, theme rollback, domain check, launch gates | Pages and navigation menus, blog, per-product SEO, redirects, collections page layout control, banners and announcement scheduling, favicon and social image, product reviews, search settings |

### Analytics and reporting (the example you raised)
| Today | Missing |
|---|---|
| Net sales bars (peak labelled), orders, AOV, refunds, top products, a live view (demo) | **No hover or tooltip on any chart**, date range picker and comparison, sales by product, channel, customer type, location, discount, payment method; conversion funnel; returning versus new customers; cohort retention; abandoned checkouts; inventory sell-through; profit (needs cost); saved and scheduled reports; CSV export; custom report builder |

Sourcing: sales, orders, customers, stock, discounts are computable from the engine's own database. Visitor traffic and funnels need a tracker on the storefront. Open-source options to evaluate *(to confirm licences and hosting cost)*: Umami (MIT) or Plausible (AGPL), both cookieless; PostHog for product analytics. Charting: replace hand-built SVG with a library that gives tooltips, crosshair and brush (Recharts or Apache ECharts, both permissively licensed).

### Marketing and communication
| Today | Missing |
|---|---|
| Rule-based emails (order, stock, abandoned-style reminders) with consent and throttling | Template editor, campaigns and newsletters, segments, back-in-stock, review requests, abandoned checkout recovery, SMS, popups, discount-code emails, unsubscribe centre |

### Team, security and platform
| Today | Missing |
|---|---|
| Owner, manager, fulfilment, analyst labels; invitations *(not connected)* | Real roles and permissions per store (Vendure roles), staff activity log, two-factor, API keys for integrations, webhooks *out* to the merchant's tools, data export and deletion tools |

## 3. The flows that must be modelled properly
1. **Order**: lifecycle above, with payment and fulfilment as separate axes (the portal already does this). Add Modifying, cancel before and after fulfilment, returns.
2. **Fulfilment**: Created, Pending, Shipped, Delivered, Cancelled, partial by line, tracking, notify customer.
3. **Refund**: full, partial, by line, restock choice, fee reversal (built); dispute lifecycle (planned).
4. **Stock**: allocation at payment, sale at fulfilment, release on cancel, cancellation on return, adjustment (built in engine). Packs and singles (built).
5. **Checkout**: cart, shipping, tax, discount, payment, confirmation, failure and retry, abandoned recovery.
6. **Product lifecycle**: draft, published, archived, deleted; variants, options, media, collections, search index.

## 4. Where we are right to rely on Vendure, and where we need other open-source parts
- Rely on Vendure for the commerce core (catalogue, orders, stock, promotions, shipping and tax calculators, customers, assets, roles). It already provides roughly ten times what the portal exposes.
- Add open-source or standard parts for gaps *(each to be reviewed for licence, upkeep, tenancy)*:
  | Gap | Candidate |
  |---|---|
  | Rich text descriptions | TipTap (MIT) |
  | Data tables with sort, filter, bulk select | TanStack Table (MIT) |
  | Charts with tooltips | Recharts or Apache ECharts |
  | Visitor analytics | Umami or Plausible, self-hosted |
  | Storefront search with typo tolerance | Meilisearch or Typesense (self-hosted) when the catalogue grows; Vendure's default search until then |
  | Transactional email design | React Email (MIT) with Resend |
  | Invoices and packing slips | react-pdf or pdf-lib |
  | Image transforms | Vendure asset server (sharp) with R2 |
  | Carrier rates and labels | Royal Mail Click & Drop or a carrier aggregator API *(to confirm UK options and cost)* |

## 5. The blocker that sits under all of it: the tenant guard
The guard default-denies every Admin operation not on its list, which is correct for safety. It also means **each new merchant feature needs three things together**: the operation added to the allowlist, an ownership check where it takes ids (so one store can never touch another's data), and a test in the isolation suite. Features must be delivered in that shape, not as UI alone.

## 6. Proposed build order
**Phase 1: make the basics complete (mostly UI on permitted operations)**
1. Product editor: edit everything, delete, duplicate, description, SEO, tags, **images at creation and editing** (needs the R2 keys on the engine).
2. Orders: cancel, notes, resend, packing slip, bulk fulfil, partial fulfil by line.
3. Discounts: edit, pause, delete, automatic discounts, buy X get Y, start dates.
4. Collections: edit, delete, manual and rule-based.
5. Customers: detail page, notes, tags, groups (adds guard entries and tests).
6. Analytics v2: tooltips and crosshair on every chart, date range with comparison, sales by product and by channel, CSV export.

**Phase 2: operate**: draft orders and order editing; stock locations, history and counts; returns; delivery rules by weight, value and postcode; abandoned checkouts; reports; staff roles and activity log.

**Phase 3: grow**: segments and campaigns; reviews; subscriptions; trade pricing; visitor analytics and funnels; search; carrier labels; storefront pages and menus.

Everything ships with a sensible default and one-switch setup, per the roadmap in `docs/design/smart-engine-roadmap.md`.


## Progress log (Phase 1)
Done and proven (browser checks for the screens; real Vendure for engine behaviour; guard isolation tests for anything new a merchant may call):
- **Analytics v2**: real charts (axes, crosshair tooltip, previous-period overlay), six metrics with trends, date ranges, breakdowns, CSV export. Pure report module with tests.
- **Product editor**: full create and edit (description, SEO, compare-at, barcode, weight, VAT), real photo upload (multipart) with reorder and remove, delete. Photos are channel-checked in the guard.
- **Orders**: cancel (optional refund, stock released), private notes, partial fulfilment by line, printable packing slip.
- **Discounts**: code or automatic; percentage, amount, free delivery, repeating buy X get Y (custom action, because Vendure's built-in applies once per order); chosen products; dates; per-customer limits; edit, pause, resume, delete.
- **Collections**: by-name or hand-picked, edit and delete (membership is recalculated by the engine's background queue, so counts can lag a moment).
- **Customers**: search, computed segments (new, returning, top spenders, not back in 60 days), detail page with order history, addresses, private notes, profile edit.

Findings worth keeping:
- Vendure's **customer groups are global** (no channel), so they are deliberately NOT offered to merchants; a regression test keeps them closed. Segments are computed in the portal instead.
- Vendure's built-in **buy X get Y free applies once per order**; we ship a repeating custom action (`oss-buy-x-get-y`) with unit tests.
- Provisioning now re-syncs an existing store's role permissions, so existing stores pick up new features.

Not done in Phase 1: rich-text descriptions, product tags and duplicate, phone photo hand-off in the new editor, resend order confirmation, bulk fulfil, customer create/import/merge.


## Progress log (Phase 2)
- **Orders taken by hand** (phone, message, in person): create, fill, record payment (cash, card in person, bank transfer, other) and place in one step, with stock reserved. Failures delete the draft, so nothing half-made is left. Vendure requires a delivery option to take payment, so the form requires one (a free "Collection" option is used for sales in person). Manual payments are recorded as received: they do not go through Stripe, so they carry no platform fee.
- **Guard**: the draft-order operations are opened with ownership checks on every order, line, customer and delivery method named; `transitionOrderToState` is limited to the single step a hand-made order needs. Tested against a second store.
- **Merchant roles now sync at every start**, so new permissions reach existing stores without re-provisioning.

Next in Phase 2: edit an order after it is placed, stock locations and stock history, returns, delivery rules by weight/value/postcode, abandoned checkouts, staff roles.
