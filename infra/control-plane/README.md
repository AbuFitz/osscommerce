# Control plane database

One Neon project per environment, all AWS London (`aws-eu-west-2`), PG 18, database `control_plane`. Synthetic data only outside production.

| Environment | Neon project | Id | Status |
|---|---|---|---|
| dev | `oss-commerce-dev` | `polished-art-58971441` | migrations 0001–0002 last verified applied |
| staging | `oss-commerce-staging` | `plain-waterfall-47874269` | migrations 0001–0002 last verified applied |
| production | `oss-commerce-prod` | not created | create on a paid plan with PITR before any real data |

Both live projects are on the free plan: 6 hours of history, no restore drills possible. Do not treat them as durable.

Verified on dev (rolled-back transaction as role `oss_runtime`): no store context returns 0 rows; store A cannot read or write store B; write grants over 60 minutes are rejected; the audit log rejects delete; only verified hostnames resolve.

The repository currently contains migrations 0001–0018. Migration 0009 adds tenant-scoped, verified sender profiles, a unique Resend message lookup, and replay-safe email webhook events. Migration 0010 adds source checksums so an edited applied migration fails closed. Migration 0011 seeds essential service-email rules; migration 0012 adds the immutable marketing-consent ledger and tenant policy settings; migration 0013 adds tenant-scoped service requests and narrow, audited quote-decision functions; migration 0014 adds narrow draft/publication functions and authenticated storefront reads for published content; migration 0015 adds durable, audited merchant launch requests without granting merchants launch approval; migration 0016 adds audited store preferences and versions affected storefront configuration; migration 0017 binds each store to its platform Stripe Billing customer and subscription without mixing those IDs with Stripe Connect; migration 0018 replaces broad hostname-verification writes with one tenant-scoped audited function. The table above records the last externally verified cloud state; it does not imply that later repository migrations have been applied.

Run `CONTROL_PLANE_DATABASE_URL=... npm run migrate:control-plane` with the schema-owner deployment credential. The runner takes a database advisory lock, applies each migration transactionally, records SHA-256 checksums and refuses unknown or changed applied migrations. `npm run migrate:control-plane -- --check` is read-only and exits 2 when work is pending. Never use the tenant runtime credential for migrations.

Not done: login role and password for `oss_runtime` (create before deploying the automation worker; keep it in the platform vault, never in Git), applying and verifying migrations 0003–0018 in each environment, production project, per-merchant engine cell databases.
