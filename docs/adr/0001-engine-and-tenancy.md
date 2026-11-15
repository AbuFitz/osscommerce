# ADR 0001 — Commerce engine and tenancy model

Status: accepted for pilot build · Date: 2026-11-14 · Supersedes the "preferred for a two-store proof" note in research/01.

## Decision
1. Keep **Vendure 3.8.2** as the commerce engine (catalogue, orders, stock, promotions, state machines).
2. **One engine cell per merchant**: a Vendure process + its own database. Cells are packed onto shared runtime pods; a *database* is never shared between unrelated merchants.
3. Vendure **channels are used for commercial structure only** (one default channel per cell), never as the tenant boundary.
4. The engine is a separate, network-isolated service (GPL-3.0-or-later). The portal, gateway and storefronts talk to it only over its GraphQL API. Legal review of the GPL position is still required before commercial rollout.
5. **Stripe Connect direct charges** via the official Stripe plugin hooks, not a bespoke payment handler.

## Evidence (executed, not inferred)
`services/engine/proofs/isolation.proof.ts` boots Vendure 3.8.2, creates two unrelated merchants (channels, sellers, channel-scoped roles/admins) and registers the same shopper email at both. Raw output: `isolation-results-vendure-3.8.2.json`.

| Probe | Result |
|---|---|
| Same email registers at both stores | works, but resolves to one global `User` |
| Password set at store A logs into store B | **LEAK** — `CurrentUser` returned |
| Customer rows distinct per store | **LEAK** — shared record, inconsistent per-channel membership |
| Merchant admin forging another store's channel token | denied |
| Merchant admin enumerating other tenants' roles | denied |
| Global zones / tax rates / countries visible to merchant admins | visible (read-only, low sensitivity; hide in OSS portal) |

Source corroboration (`packages/core`): `CustomerService.create` looks the customer up by email *across* channels and "brings it to this Channel"; `User.identifier` is a single global namespace; `Customer`/`Product` are many-to-many to `Channel`.

Admin-side channel scoping works. **Shopper identity and customer data are not tenant-isolated**, which the research listed as a fail-closed condition.

## Consequences
- Isolation is physical (database per merchant), so a cross-tenant bug in Vendure or a plugin cannot cross merchants. Neon scale-to-zero makes a database per store affordable; a Vendure process per store is not, so the pod runs a small number of cells and we measure memory per cell before promising density.
- Cost: per-cell migrations must be orchestrated (the control plane runs them cell by cell, canary first). Cross-merchant analytics are an OSS-side warehouse concern, fed by events.
- Rejected alternatives: (a) custom authentication strategy + email aliasing inside one shared DB — fragile against core upgrades, every core service path that looks up by email would need patching and re-proving; (b) Medusa — not evaluated against source in this pass, still the documented fallback (MIT core, sales channels are also not tenancy); (c) building an engine — out of scope.

## Stripe
`@vendure/payments-plugin` 3.5.6 `StripePlugin.init` accepts `requestOptions` (e.g. `stripeAccount`) and `paymentIntentCreateParams` (e.g. `application_fee_amount`). The cell resolves the connected account from the store registry and the fee from a versioned contract record; neither comes from the client. Still open: Stripe account/controller configuration, UK eligibility, liability and fees, and Connect webhook (`account`) deduplication, which the plugin does not do for us.

## Not validated here
- The existing OSS Manage platform's auth/schema were not accessible in this session (only `osscommerce` and `onesimplesite-web-designer` were in scope). `docs/manage-integration.md` defines the contract Manage must satisfy; reconcile after inspecting it.
- No infrastructure, payment account or real data exists. Medusa, load/concurrency tests and restore drills remain open gates.

## Addendum: engine capability audit
See `docs/engine/capability-coverage.md`. The portal's model was not derived from the engine's schema; the audit lists the gaps (variants and options, collections, shipping calculators, tax categories, roles as permission sets, draft orders) and the order to close them.
