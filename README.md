# OneSimpleSite Commerce

Managed commerce for independent businesses. Research is in `research/`; decisions and evidence are in `docs/`.

| Path | What it is | Status |
|---|---|---|
| `apps/portal` | Merchant portal (Next.js 16). Overview, Orders, catalogue, inventory, customers, analytics, payments, automations, email, storefront and settings. | Demo mode is labelled and isolated. Live mode uses the merchant's engine session plus tenant-RLS control-plane data. |
| `apps/site` | Marketing website: brand-true dark editorial design, DOM device hero (iPhone, iMac-style display), 3D product renders, layered widget stage, motion pieces, pricing from the brief, contact, and seven legal documents (draft). Port 3200. | Builds and verified at desktop and mobile; pricing provisional; legal unreviewed |
| `packages/emails` | React Email templates (order, dispatch, refund, payment failed, password reset, merchant new order) rendered to HTML and text | Rendered by the automation worker and delivered through Resend |
| `packages/ui` | Shared dialog, toggle and toast used by both apps | In use |
| `packages/contracts` | Roles and operations, plus config-driven plans, entitlements, fee tiers, overrides and promotions with a pure resolver | Shared by the site, portal, engine and billing flows |
| `services/engine` | Vendure 3.8.2 (GPL, isolated service). Catalogue, orders, tenant guard, Stripe Connect handler, outbox, R2 assets and launch readiness. | Built and verified; hosted staging remains an external deployment gate |
| `infra/control-plane` | Postgres control plane: registry, storefronts, payments, integrations, automation, sender identity, enquiries, preferences and platform billing. | Checksummed migrations through `0017`; apply per environment with the schema-owner credential |
| `apps/automation-worker` | Always-on pg-boss automation and email worker with signed ingest, Resend webhook and secure unsubscribe. | Deployable container; hosted runtime and credentials still required |
| `docs/product-direction.md` | Responsibility boundary, self-service coverage, checkout, email, automation, content, legal, pricing, trust; decisions and open questions | Written |
| `docs/adr/0001-engine-and-tenancy.md` | Engine decision with executed evidence | Accepted for pilot build |
| `docs/manage-integration.md` | Contract OSS Manage must meet | Manage not inspected |

```bash
npm install
NEXT_PUBLIC_OSS_DEMO=1 npm run dev -w @oss-commerce/portal   # portal on :3100 (demo data)
npm run dev -w @oss-commerce/site                              # site on :3200
npm run proof:isolation    # re-run the Vendure tenancy probe (needs services/engine install)
```

## Launch gates still open

The codebase now contains the engine cell, live portal gateway/auth, Stripe Connect payment handler and webhook processing, storefront SDK, a deployable storefront gateway runtime, provisioning state machine, automation/email worker, secure unsubscribe, and safe control-plane migrator. Real payments remain disabled until the hosted engine and gateway, migrated environment databases, R2, Stripe sandbox/live credentials, Resend sender domain and production DNS are configured and verified. The portal deliberately refuses to substitute demo data in production.

See `docs/launch-status.md` for the latest evidence and blockers, and `docs/environments.md` for dev, staging and production.
