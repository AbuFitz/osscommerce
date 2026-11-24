# Running the storefront gateway

The gateway is the only public route from merchant storefront servers to engine cells. It authenticates the storefront, fixes the tenant and cell, strips caller-supplied channel and authentication headers, enforces the operation allowlist, binds shopper sessions to one storefront, and persists idempotent mutation responses.

Deploy `apps/gateway/Dockerfile` as a separate Railway service. The repository also contains `apps/gateway/railway.toml`; set that file as the service configuration when Railway does not discover it automatically.

## Required environment

| Variable | Purpose |
|---|---|
| `APP_ENV` | `staging` or `production` |
| `CONTROL_PLANE_DATABASE_URL` | TLS PostgreSQL URL for a non-owner login that inherits `oss_runtime` |
| `GATEWAY_SESSION_KEY` | 32 random bytes encoded as 64 hexadecimal characters; never reuse another application secret |
| `PORT` | Injected by Railway; defaults to `3300` |

Optional capacity controls are `DATABASE_POOL_MAX`, `UPSTREAM_TIMEOUT_MS`, `STOREFRONT_BURST`, `STOREFRONT_PER_SECOND`, `SESSION_BURST`, and `SESSION_PER_SECOND`. Defaults are conservative for one small Railway instance. The in-process token buckets are bounded and release idle keys; use an external distributed limiter before running multiple gateway replicas.

## Deployment checks

1. Apply the control-plane migrations through `0016_store_preferences` using the schema-owner deployment credential.
2. Create a separate gateway login that inherits `oss_runtime`. Do not use the schema owner. Startup checks both conditions and exits if either is wrong.
3. Set the database URL with `sslmode=require` or stronger outside development.
4. `/healthz` proves the process is accepting HTTP. `/readyz` also proves PostgreSQL is reachable and is the Railway health check.
5. Keep the gateway private until a storefront credential, cell registry entry, and HTTPS cell URL have been provisioned. A credential cannot select a different storefront or cell.

The gateway exposes `/v1/shop`, `/v1/content/:entry`, `/v1/preferences`, and `/v1/meta`. It has no administrator route and never returns control-plane credentials, channel tokens, or raw engine sessions.
