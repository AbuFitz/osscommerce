# Automation worker deployment

Run `apps/automation-worker/Dockerfile` as one always-on process. It accepts signed cell events at `/events/ingest`, executes durable pg-boss jobs, sends through Resend, ingests signed Resend events at `/webhooks/resend`, and exposes secret-free `/healthz` and `/readyz` probes.

Required secrets: `CONTROL_PLANE_DATABASE_URL` (non-owner `oss_runtime` login), `QUEUE_DATABASE_URL` (separate queue/schema-owner role), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `CELL_CREDENTIALS_JSON`. The latter is an object keyed by cell id with `{ "storeId", "secret" }`; keep it only in the host vault. Required config: `APP_ENV`, `PUBLIC_BASE_URL`, and optional `PORT`.

Marketing and delayed state-dependent automations fail closed until consent, live-order-state and plan-limit adapters are deployed. The seeded rules in migration 0011 are transactional order confirmation and dispatch only.
