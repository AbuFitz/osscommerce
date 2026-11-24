# Product direction: what OSS Commerce is, and how it is built

Status: working decisions, 14 Nov 2026. Sources are linked where a claim was checked; everything else is a recommendation to validate.

## 1. Responsibility boundary
OSS is responsible for **technology**: initial configuration, storefront development, infrastructure, hosting, security, monitoring, platform maintenance, payment integration, technical reliability. The **merchant runs the business** through the portal. Anything beyond that (product uploads, redesigns, content, extra integrations) is a **service request**, quoted and billed separately. Product, pricing and marketing all follow this line.

## 2. Self-service coverage (what the portal must let a merchant do without contacting OSS)
| Area | State in this repo |
|---|---|
| Orders, fulfilment, refunds | Built (demo data): list, detail, fulfil and refund dialogs via server actions |
| Products, stock | Listing and stock views built; **editor, variants, collections, CSV import not built** |
| Customers | List built; account history and communications not built |
| Discounts | List built; **create/edit rules not built** |
| Shipping and tax | View built; **editing not built** |
| Payments | Merchant status view, registry-bound hosted Connect onboarding, engine payment/refund path and webhook handling built; real sandbox completion still needs human Stripe onboarding and credentials |
| Team, roles, support access | View, invite and approve/revoke built (demo) |
| Storefront content | **Content manager built (structured sections, preview, publish) with demo data** |
| Legal pages | **Editor built with guided templates** |
| Emails | **Template preview and notification settings built; React Email templates in `packages/emails`** |
| Automations | **Rule list and run history built with demo data; engine not built** |
| Service requests / support | **Requests with quote-and-approve flow built with demo data** |
| SEO metadata | Fields in the content manager; per-product SEO not built |

## 3. Checkout architecture
- **Payments:** Stripe Connect **direct charges**, so the charge lives on the merchant's own account and our fee is an `application_fee_amount`. Server creates the PaymentIntent with the connected account and fee from the store registry and the versioned agreement. Never the client. ([Stripe: direct charges](https://docs.stripe.com/connect/direct-charges))
- **Refunds:** application fees are **not** refunded automatically; the refund call must set `refund_application_fee`. Partial refunds refund the fee proportionally when it is true. The refund dialog exposes this choice. Policy default (refund our fee or not) is a **commercial decision still open**.
- **Direct-charge visibility:** PaymentIntents live on the connected account and must be read with the `Stripe-Account` header, so reconciliation jobs and webhooks must be account-aware. Connect webhooks carry the `account`; dedupe on `(account, event id)`.
- **Express checkout:** Stripe's Express Checkout Element supports Link, Apple Pay, Google Pay (plus PayPal, Klarna, Amazon Pay where enabled), shown only when the browser, wallet and country support them; domains must be registered in test and live; Link is not supported in in-app webviews. Hide the express row when `availablepaymentmethodschange` reports none. ([Stripe: Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element))
- **Shop Pay:** it is part of Shopify Payments for Shopify stores, so it is **not** available to us. Do not promise it. Link is the closest accelerated-checkout equivalent. ([Shopify: Shop Pay](https://help.shopify.com/en/manual/payments/shop-pay))
- **Accounts:** guest checkout by default. Optional shopper accounts per merchant, passwordless (email code) first. Because Vendure shares shopper identity across channels (ADR 0001), accounts are only safe because each merchant has its own engine cell.
- **Correctness:** server recalculates every total; stock reserved atomically; idempotency key per order submission; payment recovery page for failed or abandoned payments; expired discounts return a clear message.
- **Abandoned checkout emails:** treat as **marketing** needing explicit opt-in (PECR). Needs legal confirmation before enabling.
- **Branding:** a single checkout foundation themed with merchant colours, logo and radius tokens. Layout and flow are not themeable.

## 4. Email system
- Templates in `packages/emails` using **React Email** (MIT), rendered to HTML and plain text on the server, sent through **Resend** (MIT SDK) from a verified per-merchant sending domain.
- **Transactional** (order, payment, dispatch, refund, account, password) is separate from **marketing**: different sender streams, no marketing content in receipts, marketing requires consent and carries unsubscribe and List-Unsubscribe headers; consent is a ledger, not a flag.
- Merchants may edit **supported fields only** (subject, preheader, intro, footer, logo, colours, contact details). Order data, totals, legal lines and links are not editable.
- Reliability: enqueue in the same transaction as the event, retry with backoff, idempotency key per `(event, template, recipient)`, bounce and complaint suppression, per-merchant send log visible in the portal.

## 5. Automation architecture
Domain events (order paid, fulfilled, refunded, stock low, checkout abandoned) come from the engine and verified Stripe webhooks into a **transactional outbox**, then a durable job runner executes merchant-configured rules.
- **Recommendation: pg-boss** (Postgres-backed, MIT, transactional enqueue, retries, schedules, singleton keys for de-duplication). It fits the existing database and avoids running Redis. **Open validation:** it polls, which keeps a scale-to-zero Neon compute awake (cost), and it needs a direct, non-pooled connection for LISTEN/NOTIFY.
- Alternatives: **BullMQ** (MIT; needs Redis; higher throughput), **Inngest** (Apache-2.0 SDK; hosted service dependency).
- Every run is **auditable** (input event, rule version, outcome, retries) and visible in the portal. Marketing rules are skipped when consent is missing. Rules have per-merchant rate limits and a kill switch.

## 6. Storefront content management
Merchants edit **content, not layout**. Each theme declares typed sections (hero, image and text, product row, announcement, rich text, FAQ). Each section has a constrained schema (length limits, required image alt text, link validation). Pages hold ordered sections. Drafts are previewed through a signed preview URL; **publish** writes an immutable version the storefront reads; rollback is one click. Images go through an upload pipeline (type sniffing, size limits, responsive variants). This is how merchants keep control without being able to break the design we built.

## 7. Legal pages
Editable, versioned pages (privacy, terms, shipping, returns) from guided templates with fill-in variables. The portal says plainly that these are **tools, not legal advice** and that the merchant is responsible for their policies. Required pages are a launch gate.

## 8. Pricing and entitlements
Prices, fees, allowances and feature flags live in data, not code. `packages/contracts/src/plans.ts` defines plans, entitlements, fee schedules and per-merchant agreements (overrides, promotions, effective dates) with a pure resolver. Starting points from the brief: Commerce £49.99/month, build from £699, 0.5% transaction fee; Plus £99/month, build from £1,499, reduced fee for volume. **Provisional** until infrastructure cost, Stripe Connect fees and entitlements are validated.

## 9. Trust and ownership
Merchant owns domain, brand, products and customer relationships; payments are in their own Stripe account; data is exportable. Processes still to build: onboarding checklist, data export job, account closure, domain handover, backups with tested restore, service status, support. OSS Manage and the portal are one account: contracts, subscriptions, invoices and support requests link from the portal (integration contract in `docs/manage-integration.md`).

## 10. Decisions and what is still open
Resolved:
- Application fee is returned on refunds by default, proportionally (ADR 0002).
- Abandoned-checkout email needs explicit, separate opt-in (ADR 0002).
- Plus commission is 0.3%, falling to 0.2% from £100,000 a month; Commerce 0.5% (ADR 0002, `docs/economics`).
- Job runner is pg-boss in the control plane, BullMQ in cells, validated on Neon (ADR 0003).

Still open: Connect controller configuration and fees (eligibility for Stripe-handled pricing is unverified), final plan entitlements, whether Link is enough as the accelerated option, solicitor review of the legal drafts.
