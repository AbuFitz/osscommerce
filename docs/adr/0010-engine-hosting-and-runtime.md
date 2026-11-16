# ADR 0010: where the engine runs, and how the portal reaches it

Date: 16 November 2026. Status: proposed (needs the owner's choice of host).

## The pieces, in plain terms
- **Engine (Vendure)**: the commerce back end. It holds products, orders, stock, customers and takes payments. It is a long-running Node.js program with two parts: a **server** that answers API calls and a **worker** that does background jobs (emails, search index).
- **Cell**: one running engine for one merchant, with its own database (ADR 0001).
- **Database**: PostgreSQL. This is what Neon provides. Neon stores the data; it does not run the engine.
- **Portal and marketing site**: Next.js apps on Vercel. They are front ends. The portal talks to the engine's Admin API.
- **Control plane**: our own Postgres database on Neon that records which stores exist, enquiries and platform state.

## Research (Vendure documentation, read 16 Nov 2026)
- Server and worker each use roughly 200 to 300 MB of memory idle; 512 MB per process is the practical minimum. Node is single-threaded, so capacity is added by running more instances, not bigger ones.
- Running more than one instance needs shared state outside the process: an external job queue and session cache.
- Vendure publishes a guide for Google Cloud Run (containers that scale to zero and bill while running), using a managed SQL database, object storage for assets and Cloud Tasks for jobs.
- Production settings: environment variables for secrets, non-default superadmin credentials, an explicit CORS origin list, the HardenPlugin, optional UUID ids, a UTC database, and `trustProxy` behind a load balancer.
Sources: docs.vendure.io deployment pages "production-configuration", "horizontal-scaling", "server-resource-requirements", "deploy-to-google-cloud-run".

## What that means for us
- **Vercel cannot host the engine.** It runs short-lived functions, not a long-running server with a background worker. Vercel stays for the portal and site.
- **Neon is the right database** and is already provisioned: `oss-cell-demo` (cell database), `oss-commerce-dev` and `oss-commerce-staging` (control plane), all in London.
- **The missing piece is a container host** for the engine. Any of these fit: Google Cloud Run (documented by Vendure, scales to zero), Railway, Render or Fly.io (simpler, always-on), or a VPS. I have not compared current prices; that needs checking before choosing.
- **Redis** is needed for the job queue in staging and production (ADR 0003: polling the database would keep Neon awake). A small managed Redis such as Upstash fits.
- **Product images** need object storage (S3-compatible, e.g. Cloudflare R2) because containers have no permanent disk. Not built.

## Decision
1. One Docker image runs a cell (`services/engine/Dockerfile`), in `MODE=both` (server and worker in one process) for small stores, split into `server` and `worker` when a store grows.
2. The cell is configured only by environment and refuses to start on missing or unsafe settings (`cell/env.ts`).
3. Schema changes are TypeORM migrations in `services/engine/src/migrations`, applied at boot. `synchronize` is off.
4. `npm run setup` prepares a new cell: UK zone and VAT rates, delivery method, the Connect payment method, tax-inclusive pricing, and the **merchant's own administrator with a limited role** (`merchant-owner`). Merchants are never SuperAdmin.
5. The portal signs the merchant in against their cell and sends their bearer token on every call (see `docs/deploy/portal-live.md`). The portal holds no service credentials.

## Proven
- Migrations generated and applied on PostgreSQL 16; the server boots from `src/main.ts`; setup creates the merchant.
- Signed in as the merchant, the portal adapter adds a product and adjusts stock; the engine refuses that login creating administrators, reading administrators, changing the channel or changing global settings.
- `portal-adapter.test.ts`: orders, fulfilment and refunds over HTTP against a real Vendure.
- The Docker image builds (about 835 MB) and runs as a non-root user; started as a container against PostgreSQL it served the merchant's sign-in and catalogue to the portal adapter.

## Not proven or not built
- The engine has not been run against Neon itself: this workspace cannot open database connections to Neon (only the management connector works). Neon runs PostgreSQL 18 and the local proof used 16.
- Redis-backed job queue in a deployed setting, asset storage, CORS origin list for browser clients, UUID ids, backups and monitoring.
- Routing several merchants: today one portal deployment points at one cell. The control plane lookup (signed-in merchant to their cell) is the next architectural step for more than one store.
