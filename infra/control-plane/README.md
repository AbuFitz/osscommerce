# Control plane database

One Neon project per environment, all AWS London (`aws-eu-west-2`), PG 18, database `control_plane`. Synthetic data only outside production.

| Environment | Neon project | Id | Status |
|---|---|---|---|
| dev | `oss-commerce-dev` | `polished-art-58971441` | migrations 0001–0002 applied |
| staging | `oss-commerce-staging` | `plain-waterfall-47874269` | migrations 0001–0002 applied |
| production | `oss-commerce-prod` | not created | create on a paid plan with PITR before any real data |

Both live projects are on the free plan: 6 hours of history, no restore drills possible. Do not treat them as durable.

Verified on dev (rolled-back transaction as role `oss_runtime`): no store context returns 0 rows; store A cannot read or write store B; write grants over 60 minutes are rejected; the audit log rejects delete; only verified hostnames resolve.

Not done: login role and password for `oss_runtime` (create when the gateway exists; keep it in the platform vault, never in Git), a migration runner (`migrate.mjs` is next; today migrations are applied by hand and recorded in `cp.schema_migrations`), production project, per-merchant engine cell databases.
