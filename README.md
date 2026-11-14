# OneSimpleSite Commerce

Managed commerce for independent businesses. Research is in `research/`; decisions and evidence are in `docs/`.

| Path | What it is | Status |
|---|---|---|
| `apps/portal` | Merchant portal (Next.js 15). Overview, Orders, Order detail, Products, Inventory, Customers, Discounts, Analytics, Storefront, Settings (Payments, Shipping and tax, Team and access). Floating glass frame with icon rail on desktop; floating tab bar on mobile. | Builds; verified at 1440 and 390 px. **Runs on labelled demo data** behind `CommerceGateway`. |
| `packages/contracts` | Zod schemas and role/operation model shared with OSS Manage. | Typed, not yet consumed by a service |
| `services/engine` | Vendure 3.8.2 (GPL, isolated service). Holds the isolation proof. | Proof runs; cell config not built |
| `infra/control-plane` | Postgres control plane on Neon (dev). | Migration applied and probed |
| `docs/adr/0001-engine-and-tenancy.md` | Engine decision with executed evidence | Accepted for pilot build |
| `docs/manage-integration.md` | Contract OSS Manage must meet | Manage not inspected |

```bash
npm install
npm run dev                # portal on :3100
npm run proof:isolation    # re-run the Vendure tenancy probe (needs services/engine install)
```

## Not built yet
Engine cell (Vendure config with Stripe `requestOptions`/`paymentIntentCreateParams`), cell provisioning, real HttpGateway and auth, Stripe Connect onboarding and webhook inbox, refunds, discounts UI, analytics beyond the overview, OSS operations console, storefront SDK, CI, load and restore tests. Nothing here accepts payments.
