# Automation worker deployment

Run `apps/automation-worker/Dockerfile` as one always-on process. It accepts signed cell events at `/events/ingest`, executes durable pg-boss jobs, sends through Resend, ingests signed Resend events at `/webhooks/resend`, and exposes secret-free `/healthz` and `/readyz` probes.

Required secrets: `CONTROL_PLANE_DATABASE_URL` (non-owner `oss_runtime` login), `QUEUE_DATABASE_URL` (separate queue/schema-owner role), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET` (32 random bytes as 64 hex characters), and `CELL_CREDENTIALS_JSON`. The latter is an object keyed by cell id with `{ "storeId", "secret" }`; keep it only in the host vault. Required config: `APP_ENV`, `PUBLIC_BASE_URL`, and optional `PORT`.

Migration 0012 provides an immutable consent ledger, per-store limits and quiet hours. State guards use the durable event ledger, and unsubscribe links carry authenticated encrypted tokens rather than addresses or forgeable query parameters. The seeded rules remain transactional order confirmation and dispatch only; marketing rules must be deliberately enabled after the storefront emits consent and checkout lifecycle events.
