# ADR 0011: tenant isolation on the shared engine

Date: 16 November 2026. Status: implemented and tested on a real Vendure 3.8.2 over HTTP.

## Decision
Many merchants share one engine. Each store is a Vendure **channel** with its own role, stock location, shipping method, payment-method assignment and administrator. A channel is **not** a security boundary on its own, so the cell adds a **tenant guard** (`services/engine/src/cell/tenant-guard.ts`), a server-side interceptor that applies to every merchant session (any administrator who is not the platform superadmin):

1. **Default deny.** Only operations on an explicit merchant allowlist run. Everything else is refused (global operations such as channels, jobs, roles, administrators, zones, tax categories, global settings, payment methods).
2. **Ownership.** For every write that names a record by id (products, variants, collections, assets, promotions, customers, orders, payments, order lines, fulfilments, option groups), the guard checks the record belongs to the caller's channel before the operation runs.

Provisioning a store is one idempotent routine (`provision-store.ts`, `npm run provision:store`) using the operator's session, never a merchant's.

## What testing found (before the guard) on a plain Vendure with channels and channel-limited roles
| Finding | Severity | Fix |
|---|---|---|
| A merchant could change another store's variant stock by sending that variant's id (`updateProductVariants`) | Critical | Ownership check on every write by id |
| A merchant could list every channel, including other stores' channel tokens | High | Default-deny allowlist |
| A merchant could read the global job queue (job data can hold other stores' details) | High | Default-deny allowlist |
| Tax categories are global; a merchant creating one affects every store | Medium | Created once by the platform; the merchant path only looks them up |
| Option groups are not channel-aware, so one store could attach another's | Medium | Refused if attached to a product outside the caller's channel |
| A new channel has no stock location, so its stock reads as 0 and is not isolated | Functional | Provisioning creates and assigns one |
| A new channel has no delivery option and no payment method | Functional | Provisioning creates and assigns them |

## Verified (13 isolation tests in `tenancy.test.ts`, real HTTP, two stores)
Own catalogue only; read, update and delete of another store's product by id refused; stock of another store's variant untouched and refused; wrong or missing channel header returns nothing of another store; 14 global operations refused; collections, promotions, option groups cross-store refused; customers per store; each store has its own paid order and customer, B cannot read A's order, fulfil, refund (by order id, payment id or order line id), cancel or annotate it, and no refund reaches Stripe; A can still do all of that to their own; reporting totals never include another store's money; the operator can still do global work.

## Not yet covered (still to test or build)
- **Webhook routing**: today one engine has one connected-account id in its environment. Several merchants on one engine need a per-store lookup (account id to channel) in the webhook and payment code. Not built.
- **Storefront caches and the Shop API across channels**; the guard covers the Admin API only. Shop API isolation relies on the channel token and needs its own test pass.
- **Background jobs** carry channel context in Vendure but job payloads are global to the queue; operator-only access is enforced, content isolation is untested.
- **Search index** is per channel in Vendure; untested here.
- **Assets**: object keys are store-prefixed (tested); cross-store asset id attempts need the S3-backed harness (`S3_TEST=1`).
- **Promotion and customer-group edge cases**, stock-location transfers between stores, administrator invitations.
- A **second line of defence in the database** (Postgres row-level security keyed on the channel) is worth adding before many merchants share one database. Not built.
