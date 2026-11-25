# Engine plugins and configuration: what we run, what we built, what is next

Checked against `services/engine/src/main.ts`, `cell/config.ts` and `@vendure/core` 3.8.2, not from memory.

## Running now (official Vendure plugins)
| Plugin | Why |
|---|---|
| `HardenPlugin` | Caps GraphQL query complexity (650), hides field suggestions in production. Protects the public shop API. |
| `DefaultJobQueuePlugin` / `BullMQJobQueuePlugin` | Jobs in Postgres by default (survive restarts, shared by instances, bounded retries with backoff). Switches to BullMQ automatically when `REDIS_URL` is set. |
| `DefaultSearchPlugin` | Product search with buffered index updates. Fine until a store has thousands of products. |
| `DefaultSchedulerPlugin` | Scheduled housekeeping, notably clearing expired sessions. Its table has a migration. |
| `AssetServerPlugin` + S3 storage | Product photos in Cloudflare R2, with file type and size limits and a startup self-check. |

## Built by us (in this repo, because nothing off the shelf fits a multi-tenant Connect platform)
- **CellPlugin**: Stripe Connect payment handler with the application fee; webhooks and an outbox; checkout gate and payment session; **delivery zones** (countries, UK postcode areas, order value and weight limits) with flat, per-item and weight-band calculators; a read-only `orderRef` on stock movements; the default-deny **tenant guard** (every merchant mutation is allow-listed and ownership-checked); merchant role sync.
- **PackRefillPlugin**: singles and packs open automatically when stock runs low.
- **CatalogueFieldsPlugin**: SEO fields, compare-at price, barcode, weight, low-stock level, stock log.
- Custom promotion action (repeating buy X get Y), superadmin sync, threshold stock display.

## Deliberately not used
- `@vendure/payments-plugin` (Stripe): it takes payments to one account. We need Connect with a platform fee per store.
- `@vendure/email-plugin`: templates are per install. We send through our own outbox so each store has its own sender and branding (Resend, see below).
- The Vendure dashboard: replaced by the merchant portal.
- Elasticsearch, Stellate, GraphiQL: not needed at this size (GraphiQL is dev only).

## Needed next, in order
1. **Email delivery (Resend)** behind the existing outbox: order confirmation, shipping, abandoned-checkout reminders, low-stock alerts. Blocked on a Resend key and a sending domain per store.
2. **Error monitoring**: Vendure's Sentry plugin (or any APM) on the engine. Needs a DSN. Cheap, and the first thing to want once real customers exist.
3. **Request rate limits** on sign-in and checkout. Harden limits query cost, not request count. Best done at the edge (Cloudflare in front of Railway) plus a small middleware.
4. **Staff accounts and an activity log** (next build). Staff are created by the platform, never by a merchant mutation, as Vendure Administrators with a narrower role in their store's channel (`manager`, `fulfilment`). The activity log is a small table written from the engine's own events (order, product, stock, discount changes, with who) and shown in the portal.
5. **Customer data tools** (export and erase) for UK GDPR. Vendure has none. Built as controlled endpoints, not a plugin.
6. **Redis for BullMQ** once job volume justifies it (already supported by an environment variable).
7. **Carrier labels** (Royal Mail Click & Drop, Parcelforce, Sendcloud): adapters in `packages/integrations`, Phase 3.
8. **Reviews, subscriptions, trade pricing**: Phase 3, small own plugins.

## Configuration still to set (all need you)
- Stripe: secret key, webhook secret, connected account (sandbox values first).
- Resend: API key and verified sending domain.
- Sentry: DSN.
- Real merchant accounts with fresh passwords (the test merchants still have their original ones).
