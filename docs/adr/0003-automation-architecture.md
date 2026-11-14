# ADR 0003: Automation scheduling and job queues

Status: accepted; validated against real Neon (experiment below)

## Decision
- The automation engine and its scheduler (pg-boss) run in the always-on **control plane**, not in merchant cells.
- Merchant cells use **Redis/BullMQ** for Vendure's job queue. Vendure's default database-polling queue is not used outside local development; `parseEnv` refuses staging/production without `REDIS_URL`.
- A cell database is touched only when a rule actually executes.

## Why: Neon scale-to-zero measurement
Neon suspends compute after about 5 minutes idle. Any polling query defeats this. pg-boss polls every 2 s and sends a 10 s LISTEN heartbeat, so it must not point at a cell database.
Experiment (region aws-eu-west-2): one project polled every 2 s, one left alone.
- The polled control plane stayed `active`; the untouched cell database suspended at 22:11:16.
- Cold start on first query after suspension: about 1182 ms, against about 400 ms warm.
- Result: central scheduling is the only arrangement where idle merchants cost nothing and a run still starts in about a second.

## Operational rules
- pg-boss needs a **direct (non-pooled)** connection because of LISTEN/NOTIFY.
- The engine owns retries (pg-boss `retryLimit: 0`; schedule 1m, 5m, 30m, 2h, 6h, six attempts) so every attempt is visible in the audit log.
- Idempotency key is sha256(store, rule, event, recipient); duplicate event delivery cannot send twice. Verified with real pg-boss against Postgres, including crash/restart durability and row-level security isolation.

## Payments (related)
We do not use `@vendure/payments-plugin`. The cell has its own Connect handler and webhook inbox (`services/engine/src/cell`): server-computed amount and fee, re-read of the PaymentIntent from Stripe on return, de-duplication on (account, event id), monotonic payment state so late events cannot move an order backwards, and `account.updated` restricting checkout. This supersedes the Stripe section of ADR 0001.
