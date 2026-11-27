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

- **Stock by item**: every variant in one table (search, filters for low, out, back order and not counted), quick adjust with a live preview and a required reason, an item page with real history (sales, reservations, releases, changes by hand with who and why) and per-item settings (count or not, keep selling when out, low-stock level), and a stock count sheet that changes only what differs and refuses impossible counts. Reasons are kept in a small history field on the variant; Vendure does not store them. Vendure's schema links only some movements to orders and cannot sort them, so history reads the newest 100 and does not link sales to orders. Not built: multiple stock locations and transfers, purchase orders.

- **Edit an order after it is placed**: change quantities (never below what was already sent), add items (stock-checked), add a charge or discount, change the delivery address, with a private note. Two steps: make the change, then review exactly what it does to the total. A lower total refunds the difference to the original payment; a higher total needs how the extra was paid and records it. Uses Vendure's own order-modification flow (Modifying, dry run, apply, extra-payment step). Preview saves nothing. If a refund on the order is still pending, a further increase is refused with a plain reason, because Vendure's own consistency check requires the refund to settle first.
- **Returns that do what they say**: refund by returned line, with the amount filled in from the items; "put back in stock" now really raises the shelf count and is logged in the item history as a customer return. The old "return our fee" checkbox is gone: returning the platform fee on a refund is platform policy (ADR 0002), so it is stated, not offered as a choice.
- **Guard**: `modifyOrder` is opened with ownership checks on the order, every line adjusted, every refund payment and every item added; the state changes it needs are allowed, cancelling by state change is not. Proven against a second store.

Next in Phase 2: delivery rules by weight, value and postcode, abandoned checkouts, staff roles and activity log, stock locations (deliberately left out unless a merchant needs them).

- **Delivery rules**: postcode areas, ranges and outward codes in zones (served by the same logic the portal's postcode checker uses), order-value and weight limits per option, weight-band pricing, catch-all zones that automatically defer to specific ones, and a checker that tries a postcode, order value and weight against the zones. Proven against a real Vendure (what a customer is offered, with and without the Highlands, free-over, light-parcel and by-weight bands).
- **Limits addressed**: stock history pages instead of stopping at 100; every stock movement names its order (a correction: earlier reservations were not actually linked either); edits left part-way can be finished. Multi-location stock was researched and is recorded in `docs/design/stock-locations-and-limits.md` with the trigger for building it.

Next in Phase 2: abandoned checkouts, staff roles and an activity log.


- **Staff roles**: owners invite Manager, Fulfilment and View-only staff by email. Roles are fixed templates per store: a manager cannot change delivery, payments or staff; fulfilment sees orders and customers and fulfils; view-only changes nothing. Change a role, remove someone, change your own password. Proven on a real Vendure with two stores: no one can see, reach or manage another store's staff, and a removed or wrong-store login gets nothing.
- **Activity log** (`/settings/activity`): who changed what and when, from the engine's own events (orders, products, discounts, shipping, collections, customers, stock, staff), newest first, paged, filterable by person; platform-team actions are labelled "OneSimpleSite team". Owners and managers can read it.
- Deploy note: this adds the `oss_activity` table (migration `1795300000000-activity`), applied by the engine's pre-deploy step.

Next in Phase 2 (Stripe, Resend and Sentry are deferred): GDPR export and erase, rate limits, bulk fulfil, customer create and import, rich-text descriptions.

- **Bulk fulfil**: on the "To fulfil" filter, one button marks every paid, unshipped order (up to 50) as fulfilled, one by one, so a single failure is reported and never blocks the rest.
- **Customer privacy**: on a customer's page, "Download their data" (one readable file: details, addresses, orders, notes) and "Erase personal data" (name, email, phone, addresses, notes and login removed; each order's address blanked; the sale kept for your records; refused while any order is unfinished). Both are channel-checked, so one store can never read or erase another's customers, and both are written to the activity log.
- **Rate limits**: sign-in is limited to 10 attempts per account and 60 per address per 15 minutes; password-change guesses to 5. In memory per cell (a restart only ever forgives).
- Not built, by decision: standalone "add customer" and customer import. A customer already appears when you take an order for them, and Vendure's create would also reveal that an email exists in another store, so it needs a store-scoped version first.

- **Invitations by email, properly verified** (replaces the earlier one-time-password hand-over): inviting someone creates an unverified account with a password nobody knows and emails a single-use link (7 days; only a hash is stored). Following it proves they own the inbox, lets them choose their own password and verifies the account. Until then they cannot sign in. Owners can resend (the earlier link dies). "Forgot your password?" on sign-in sends a one-hour reset link to staff of that store and always answers the same, so it never reveals who works there. Both emails are essential account emails: always on, sent from the platform sender, not editable by a store. Wrong-store, expired, reused and made-up links fail identically; sign-in, reset and link attempts are rate-limited.
- To switch on at launch: `PORTAL_URL` on the engine (where emailed links point; invitations are refused without it), `ACCOUNT_EMAIL_FROM` (+ optional `ACCOUNT_EMAIL_REPLY_TO`) on the automation worker, control-plane migration `0019_account_email_rules`, and Resend with a verified sending domain.

- **Rich product descriptions**: a small editor (Tiptap, MIT; loaded only on the product page): bold, italic, heading, bulleted and numbered lists, quote, links; nothing else can be made. Stored as a safe HTML subset that every storefront can render as it is. One sanitiser (`@oss-commerce/contracts` `sanitizeRichText`) is the rule: it runs in the portal on save, and again in the engine after every product save (`DescriptionGuard`), so a description is clean however it was written. Scripts, event handlers, iframes, styles and non-web links (javascript:, data:, entity and whitespace tricks) are removed, links get `rel="noopener noreferrer nofollow"`, older plain-text descriptions become paragraphs, and search previews use the plain words. Storefronts should still render only this subset (never inject other HTML).

- **End-to-end pass on a real stack** (local Postgres 16, the real engine, the portal in live mode, a browser): migrations apply from empty; sign-in; every main page loads; a product with rich text round-trips; three hand-made orders; bulk fulfil; customer export and erase; staff invite, set-password link, sign-in, reuse refused, forgot-password, reset; sign-in lockout; activity feed. It found and fixed: (1) role-aware navigation never applied, because Vendure hides role lists from non-system administrators, so every staff member looked like an owner; the engine now answers `myRole` (least privilege if it cannot), and tests cover it; (2) hand-made orders showed "Not recorded / Paid to your Stripe account", now "Cash" etc.; (3) activity lines named orders by internal code and added a noisy "Created a fulfilment", now "#12". Not exercised locally (needs the control plane): Preferences, which fails closed without it.

## Progress log (Phase 3)

- **Saved customer segments**: build your own groups from simple rules (number of orders, total spent, days since last order, agreed to marketing; all or any), saved per store, shown beside the built-in groups on the Customers page with live counts, edited or deleted in place. Rules are stored, never the members: who is in a segment is worked out from orders each time, so it is always current. One validator (`@oss-commerce/contracts`) is the rule for both the portal and the engine; the engine checks the name, rule count (8), field, comparison and range, caps a store at 50 segments, and treats another store's segment as "not found". View-only and fulfilment roles can read but not change; owners and managers edit. New table `oss_segment` (migration `Segments1795500000000`).
- Next in Phase 3: campaigns to a segment (needs Resend and the consent ledger switched on), reviews, subscriptions, trade pricing, visitor analytics and funnels, search, carrier labels, storefront pages and menus.
- **Product reviews**: shoppers review a product from the storefront; every review waits for the merchant's approval, so nothing shows without their say. Shop API (for storefronts): `submitReview(input)` (rating 1 to 5, title, text of 10 to 2,000 characters, name, email; one review per person per product) and `productReviews(productId, take, skip)` (approved only, with `summary { count average }`, `verified`, and the merchant's `reply`). The author's email is not a field shoppers can ask for. A review is marked **verified purchase** when that email has a paid order containing the product. Reviews are plain text, stored as given: **storefronts must render them as text, never as HTML**. Rate limits: 25 attempts an hour per address and 12 per email. Portal: a Reviews page (Waiting, Approved, Rejected, All) to approve, reject, reply or delete; every action is in the activity log. Erasing a customer deletes their reviews. Store isolation proven: another store cannot see, moderate or review. Roles: owners and managers moderate; view-only can read; fulfilment does not see Reviews. New table `oss_review` (migration `Reviews1795600000000`).
- **Storefront pages and menus**: Content now has Homepage, Pages and Menus. Pages are the merchant's own (Our story, Care guide, Contact): title, address (`/pages/<slug>`), rich text (cleaned to the safe subset), search description; saved as a draft and published when ready; deleting stops it showing at once and frees the address; 50 per store; reserved addresses (privacy, cart, checkout…) are refused. Menus are the header and footer: up to 12 links each, a name and a destination that is either a page on the shop (`/…`) or `https://…` (never `javascript:`, `//` or plain http), reordered with arrows so it works the same on a phone. Same draft-and-publish store as the homepage and legal pages, so storefronts read only what is published, through the existing `cp.get_published_content` function: entries `menu/header`, `menu/footer`, `site/<slug>` (a deleted page reads as `{ "deleted": true }`). Proven against a real Postgres: draft vs published separation, cleaned body served to shoppers, delete and re-create.
- **Found and fixed while testing on a clean database: control-plane migration `0014_published_content` could not apply** (`join … using(store_id)` was ambiguous), so every migration after it was blocked. It now applies, and all 19 migrations and all eight SQL test files pass from empty. It had never applied anywhere, so editing it in place is safe.
- **Trade pricing**: a percentage off (1% to 90%) for customers marked as trade, off until switched on. Built from the engine's own customer group and an automatic promotion limited to that group, so the discount appears on the order as a "Trade pricing" line like any other and is audited like any other. Owners and managers set the percentage and mark customers from the Customers page ("Trade pricing") and a customer's own page. Catalogue prices shown to shoppers do not change; a trade customer sees the reduction in their basket and order (per-product trade prices would need a price-list strategy and are not built). Proven on a real Vendure: retail customers pay list price, trade customers get exactly the percentage, off means off, unmarking stops it, another store cannot see or mark customers, view-only can read but not change. New table `oss_trade` (migration `Trade1795700000000`). Not yet exercised through a real storefront checkout (it was proven on hand-made orders): confirm a signed-in trade customer's basket shows the reduction before relying on it.
