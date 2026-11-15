# Engine capability coverage: what Vendure provides vs what the portal exposes

Source: `services/engine/proofs/capability-map.ts`, which boots the real Vendure 3.8.2 engine and introspects it (output in `capability-map.json`): **82 admin queries, 183 admin mutations, 98 permissions**, plus the registries of built-in handlers.

Honest starting point: the portal's data model was designed from the product brief and reference imagery, not derived from this schema. Where the two disagree, the engine is right, because the portal has to be a window onto it. Priority: **P0** blocks a merchant running a real shop, **P1** expected of a commerce platform, **P2** later.

| Domain (engine) | What the engine has | Portal today | Gap and decision | Pri |
|---|---|---|---|---|
| **Products and variants** (34 operations) | Products with option groups, options, many variants (own SKU, price, tax category, stock, enabled), translations, slugs, assets with featured image, facets, collections, per-channel assignment | One flat product with a `variants` number; add product, import CSV, photos | **Built (engine-proven; portal runs on the demo gateway).** Variant and option editor with per-variant SKU, price, stock, VAT class, weight and on-sale. Real HttpGateway mapping still open. Original gap: needs an option/variant editor, per-variant price and stock, slug and description (SEO), publish toggle, and the import must create variants. Our `Product` type must become product plus variants | P0 |
| **Collections** | Merchant-managed categories with filters (facet, variant name, product id, variant id) and a preview of what matches | None | **Built (engine-proven; portal demo).** Original note: collections page with rule builder and live preview (`previewCollectionVariants`) | P0 |
| **Facets and tags** | Facets and values for filtering and search; tags for assets and customers | None | Needed for storefront filters. Facets editor; tags later | P1 |
| **Assets** (7) | Asset library, featured and ordered images, focal point, tags, channel assignment | Phone handoff and computer upload (demo storage); no library | Photo library with reorder, featured image, alt text. Storage on R2 (ADR 0007) | P0 |
| **Orders** (26) | Fulfilment (partial), cancel order, modify order, notes, manual payment, **draft orders** (create orders for phone or in-person sales), refund and settle refund with `refundDestinations`, order history | Fulfil, refund, timeline | Missing: cancel order, internal notes, partial fulfilment, delivered state, modify order, draft orders. Our refund must call `settleRefund` with the Connect refund (cell handler exists) | P0 cancel, notes, partial fulfil; P1 draft orders, modify |
| **Customers** (23) | Addresses, **customer groups**, notes, group membership | List, export | Missing detail page, notes, addresses, groups. Groups matter because promotions can target them | P1 |
| **Promotions** (10) | Conditions: minimum order amount, contains products, customer group, at least N with facets, buy X get Y. Actions: order fixed or percent, product percent, facet-based, free shipping, BOGO. Coupon code, dates, per-customer and total limits | Code, percent/fixed/free delivery, minimum spend, total uses, end date | Our form maps to a subset. Missing: product or collection targeting, customer groups, BOGO, per-customer limit, start date. Add as condition and action pickers | P1 |
| **Shipping** (12) | Zones (countries, provinces) and shipping methods, each with an **eligibility checker** and a **calculator**. Only `default-shipping-calculator` (fixed rate) and `default-shipping-eligibility-checker` (order min/max) ship in the box | Zones with named rates and "free over £X" | Our "free over" and per-zone rates do not exist natively. Options: free-shipping promotion with a minimum-order condition, or a **custom calculator plugin** (weight bands, per-item, free over, carrier rates). Needs a plugin before weight-based shipping is real | P0 |
| **Tax** (10) | Tax categories and rates per zone, prices-include-tax per channel | A VAT include/exclude display | Missing tax category per product (standard, reduced, zero) and rates per zone. UK VAT registration status belongs in the engine config | P0 |
| **Stock** (6) | Stock locations, per-variant stock with allocation, out-of-stock threshold, track inventory, backorders, movement history, channel assignment | On hand, reserved, low-stock level, adjust with reason (demo log only) | Missing: stock locations, backorder policy, stock-movement history from the engine, per-variant counts | P0 variants; P1 locations |
| **Payments** (13) | Payment methods with handlers and eligibility, manual payment, cancel and settle | Connect setup states and checkout (ADR 0005, 0006) | Done in the cell. Portal still shows demo state | P0 |
| **Roles and administrators** (16, 98 permissions) | Roles are permission sets, scoped to channels, with owner-only and super-admin | Four fixed roles in the UI | Map our owner, manager, fulfilment, analyst to real engine roles with explicit permission lists. Never expose SuperAdmin or ReadSecret | P0 |
| **Channels, sellers, zones, countries, currency, language** | Multi-currency and language support | Single GBP store | One cell per merchant (ADR 0001). Multi-currency and language later | P2 |
| **Search** | Built-in search with index updates | None | Storefront search through the engine first; Meilisearch only if needed | P1 |
| **Jobs** (8) | Job queue, failed jobs, buffered jobs | None | Belongs in the OSS operations console, not the merchant portal | P1 |
| **API keys** (new in 3.x) | Scoped API keys | None | Candidate for per-integration credentials; evaluate against our vault | P2 |
| **Settings store and custom fields** | Key-value settings and custom fields on entities | Own content system | Keep own content manifest (ADR 0004); use custom fields for engine-side flags | P2 |
| **Fulfilment** | `manual-fulfillment` handler; state transitions | Manual with tracking number | Carrier integrations later (Royal Mail, ShipStation) as fulfilment handlers | P1 |

## Not in the engine core (so we build or integrate, we do not "turn on")
Gift cards, subscriptions, abandoned-checkout recovery, returns and exchanges workflow beyond refund and order modification, reviews, loyalty, wishlists. The demo's "Gift card" product has no engine support behind it.

## Conclusions and order of work
1. **Make the portal's types come from the engine, not from us.** Generate types from the Admin API schema for the fields the portal shows, and have the real gateway map engine entities to portal views.
2. **Do product, variant, option, stock and tax-category first.** They change the shape of products, inventory, orders and import everywhere.
3. Then collections and facets, the photo library, order cancel/notes/partial fulfilment, roles mapped to permissions, and the shipping calculator plugin.
4. Promotions and customer groups follow.

None of this is built yet. This document is the audit that should have come before the portal screens.
