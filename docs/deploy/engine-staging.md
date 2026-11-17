# Engine staging deployment

| Item | Value |
|---|---|
| Host | Railway project `onesimplecommerce`, environment `staging`, service `engine-api` |
| Public URL | `https://engine-api-staging-30df39f3.up.railway.app` (`/health`, `/ready`, `/admin-api`, `/shop-api`) |
| Build | Root `Dockerfile` (a mirror of `services/engine/Dockerfile`; keep them identical). Railway does not support secret mounts, so builds use plain `npm ci` |
| Database | Neon project `oss-commerce-staging`, database `engine` (pooled URL at runtime, direct URL for migrations) |
| Release step | Pre-deploy runs `migrate:run` then `setup` (both idempotent) |
| Registry | `cp.stores` and `cp.cells` in the `control_plane` database. One cell row per store, all pointing at the shared engine URL with that store's own channel token |
| Test stores | `store-a` (channel 2) and `store-b` (channel 3), provisioned with `provision:store` |

## Verified on this deployment
- Health and readiness respond; migrations and platform setup applied on Neon PG 18.
- Store isolation: a product created in store A is returned by the Shop API for store A's channel token and not for store B's.

## Still needed (set in the Railway dashboard, never in the repository or chat)
- Stripe sandbox: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECTED_ACCOUNT_ID`. Placeholders are set today, so payments do not work.
- R2 media: `ASSET_S3_ENDPOINT`, `ASSET_S3_BUCKET=osc-media-staging`, `ASSET_S3_ACCESS_KEY_ID`, `ASSET_S3_SECRET_ACCESS_KEY`, `ASSET_S3_REGION=auto`. Set all five together; a partial set stops the engine starting.
- Rotate the Neon role password and the engine secrets before real data (they passed through session logs).
