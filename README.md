# OneSimpleSite Commerce

Managed commerce for independent businesses. Research is in `research/`; decisions and evidence are in `docs/`.

| Path | What it is | Status |
|---|---|---|
| `apps/portal` | Merchant portal (Next.js 15). Overview, Orders, Order detail, Products, Inventory, Customers, Discounts, Analytics, Storefront, Settings (Payments, Shipping and tax, Team and access). Floating glass frame with icon rail on desktop; floating tab bar on mobile. | Builds; verified at 1440 and 390 px. **Runs on labelled demo data** behind `CommerceGateway`. |
| `apps/site` | Marketing website: brand-true dark editorial design, DOM device hero (iPhone, iMac-style display), 3D product renders, layered widget stage, motion pieces, pricing from the brief, contact, and seven legal documents (draft). Port 3200. | Builds and verified at desktop and mobile; pricing provisional; legal unreviewed |
| `packages/emails` | React Email templates (order, dispatch, refund, payment failed, password reset, merchant new order) rendered to HTML and text | 5 tests; sending not wired |
| `packages/ui` | Shared dialog, toggle and toast used by both apps | In use |
| `packages/contracts` | Roles and operations, plus config-driven plans, entitlements, fee tiers, overrides and promotions with a pure resolver | 7 tests; not yet consumed by a service |
| `services/engine` | Vendure 3.8.2 (GPL, isolated service). Holds the isolation proof. | Proof runs; cell config not built |
| `infra/control-plane` | Postgres control plane on Neon (dev). | Migration applied and probed |
| `docs/product-direction.md` | Responsibility boundary, self-service coverage, checkout, email, automation, content, legal, pricing, trust; decisions and open questions | Written |
| `docs/adr/0001-engine-and-tenancy.md` | Engine decision with executed evidence | Accepted for pilot build |
| `docs/manage-integration.md` | Contract OSS Manage must meet | Manage not inspected |

```bash
npm install
NEXT_PUBLIC_OSS_DEMO=1 npm run dev -w @oss-commerce/portal   # portal on :3100 (demo data)
npm run dev -w @oss-commerce/site                              # site on :3200
npm run proof:isolation    # re-run the Vendure tenancy probe (needs services/engine install)
```

## Not built yet
Engine cell (Vendure config with Stripe `requestOptions`/`paymentIntentCreateParams`), cell provisioning, real HttpGateway and auth, Stripe Connect onboarding and webhook inbox, product editor and variants, discount and shipping editors, automation engine and email sending, OSS operations console, storefront SDK, load and restore tests. Nothing here accepts payments. The portal and site run on demo data and need `NEXT_PUBLIC_OSS_DEMO=1`.

See `docs/environments.md` for dev, staging and production.
