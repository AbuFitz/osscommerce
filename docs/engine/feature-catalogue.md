# Feature catalogue: what the engines and open-source references provide, and where we stand

Companion to `capability-coverage.md` (which maps Vendure core's admin API to the portal). This one answers: **did we use everything that was thrown over, and what else is worth having?**

## 1. Every repository or resource named in the briefs, and its real status
| Reference | Status | What was actually done |
|---|---|---|
| Vendure core 3.8.2 | **Used** | Runs as the per-merchant cell; tested end to end (checkout, outbox, webhooks, control route, isolation probe). Admin API introspected (`capability-map.json`) |
| `vendurehq/nextjs-starter-vendure` | **Studied, not used as code** | Cloned and read. Adopted its folder boundaries. Its platform layer has default-channel fallback, non-httpOnly cookie, single revalidation secret (ADR 0004) |
| `@vendure/dashboard` (React admin, 3.8.2) | **Not used. Found just now** | Ships collections, customers, orders (incl. modify and draft orders), products, roles, promotions, stock screens. Licence field is empty on npm, so confirm before any reuse. Best use: **OSS-staff console per cell**, and a reference for features the portal is missing |
| `@vendure/mcp-sdk` | **Not used. Found just now** | Lets the engine expose MCP tools for AI assistants. Interesting for "ask your store" later |
| `@vendure/email-plugin`, `graphiql`, `telemetry`, `job-queue`, `harden` | job-queue (BullMQ) and harden **used**; email deliberately replaced by our event outbox; graphiql and telemetry not used (graphiql must stay off in production) |
| `@vendure-community/payments-plugin` (Stripe) | **Evaluated, not adopted** | Correction: it does support `stripeAccount` and extra payment-intent params (so application fees) through options. It does **not** pass the connected account or `refund_application_fee` on refunds, looks customers up on the platform account, and has one webhook secret. So Connect works for charging but not for refunds or webhooks without our own code. ADR 0005 wording ("does not provide per-request connected-account context") was too strong and is corrected there |
| Medusa (nextjs-starter, modules) | **Only the module list read** | Modules: pricing (price lists), promotion, inventory, stock location, fulfilment, store credit, loyalty, translation, region, currency, API key, tax, sales channel. Starter code was not read |
| `Shopify/hydrogen`, `vercel/commerce`, `vendurehq/tanstack-starter-vendure`, `vercel/platforms` | **Not examined** | Named for pattern research (cart/checkout components, tenant routing, domains). The brief asked for this; it has not been done |
| GraphQL Code Generator (client preset) | **Chosen, not built** | SDK takes query strings today |
| `payloadcms/payload`, `sanity-io/sanity` | **Skimmed for approach only** | Chose our own manifest (ADR 0004). A hands-on evaluation was not done |
| Zod | **Used** | Everywhere (config, manifests, content) |
| React Email / Resend | **Email templates used; Resend sending not wired** | |
| Turborepo | **Not adopted** | npm workspaces for now; worth adding for task caching once CI time grows |
| Stripe samples, Payment Element, Express Checkout | **Used in `packages/checkout`; not run in a browser against Stripe** | Needs a charge-enabled test account |
| Activepieces, Windmill, Trigger.dev, React Flow | **Not adopted** | Own rule engine; licences unverified; React Flow candidate for a visual builder |
| Meilisearch, Cloudinary, Printful, Printify, ShipBob, Royal Mail, ShipStation, Postcodes.io, Ideal Postcodes, GS1 | **Manifests only** (shown in Settings > Integrations as researching/planned) | None connectable, by design |
| simple-icons | **Used** | Brand tiles (this change) |

## 2. Features other engines have that a commerce platform should consider
| Feature | Source | Decision |
|---|---|---|
| Variants and options editor, per-variant price/stock/tax | Vendure, Medusa | **P0** (see coverage doc) |
| Collections with rules and live preview; facets | Vendure | **P0 / P1** |
| **Price lists and customer-group pricing** | Medusa pricing module | P1. Vendure has no native price lists; needs a plugin or per-group promotions |
| **Draft orders** (phone and in-person sales), order modification | Vendure | P1 |
| Returns, exchanges, claims | Medusa | P2. Vendure core has refund and order modification only |
| **Store credit and gift cards**, loyalty | Medusa (plugins) | P2. Not in Vendure core |
| Customer groups and per-group promotions | Vendure | P1 |
| Multi-location stock, transfer, backorders | Vendure, Medusa | P1 |
| Translations (multi-language) | Vendure, Medusa | P2 |
| Multi-currency and regions | both | P2 |
| API keys with scopes | Vendure 3.x, Medusa | P2: candidate for integration credentials |
| Job queue visibility and retries | Vendure | Operations console (P1) |
| AI access to the store (MCP) | Vendure `mcp-sdk` | Later, read-only first |
| Bulk edit, saved views, command palette, activity log | Shopify-style admin conventions | P1 for portal polish |
| Maps: delivery areas, store or collection-point locator | requested | See section 3 |

## 3. Maps
Open-source MapLibre for rendering is a good fit (BSD licence, no vendor lock-in). Tiles are the cost and privacy question: the public OpenStreetMap tile servers are not for production traffic, so a provider (MapTiler, Stadia or self-hosted) is needed, and customer addresses must not be sent to a map or geocoding provider without consent. Plan: (1) delivery-zone map of UK postcode areas drawn as local SVG from open boundary data, with no tiles and no third party, used on the Shipping page; (2) store and collection-point locator on the storefront with MapLibre and a tile key held server-side. Listed in Integrations as "Researching" until the tile provider and privacy position are decided. **Not built.** Data-licence finding: free postcode-area polygons are Wikipedia-derived (CC BY-SA, needs attribution and share-alike) and Royal Mail boundaries are proprietary, so the delivery-zone map waits on a clean-licence boundary source. Tile provider and privacy position remain undecided.

## 4. Visuals and brand marks
Payment methods and providers now show recognisable marks (Visa, Mastercard, Amex, Apple Pay, Google Pay, PayPal, Klarna, Stripe, Meilisearch, Cloudinary, Resend, MapLibre) from simple-icons (icon artwork CC0). Where no mark exists (Royal Mail, ShipStation, Printify, ShipBob, GS1, Clearpay, Link) a monogram tile is used rather than inventing a logo. Marks identify methods on the merchant's own screens only; **shoppers see Stripe's official, correctly licensed marks** in the Payment Element. Apple Pay, Visa and Mastercard have their own usage rules, so any shopper-facing use should follow those and not these simplified marks.

## 5. Where this leaves us
The portal is a good window onto a *demo* model. The engine can do more than the portal exposes (variants, collections, promotions, draft orders, stock locations, roles). Order of work: variants and options, collections and facets, real stock, order cancel/notes/partial fulfilment, roles as permission sets, shipping calculator plugin, promotions and customer groups. Examine Hydrogen, vercel/commerce and the Medusa starter for checkout and cart components before building the reference storefront.
