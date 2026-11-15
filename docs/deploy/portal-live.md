# Running the portal live

The portal has two modes, chosen by environment, and they never mix.

| Mode | When | Data |
|---|---|---|
| **Live** | `ENGINE_ADMIN_URL` is set | The merchant's engine cell, called with the signed-in merchant's own session |
| **Demo** | `NEXT_PUBLIC_OSS_DEMO=1` and `ENGINE_ADMIN_URL` unset | Per-browser fixtures. Refused when `APP_ENV=production` |

With neither set the portal refuses to start a request rather than show fixtures.

## Environment (live)
| Variable | Purpose |
|---|---|
| `ENGINE_ADMIN_URL` | The cell's Admin API, e.g. `https://cell.example/admin-api`. Server-side only |
| `ENGINE_CHANNEL_TOKEN` | The store's channel token, when the cell hosts more than the default channel |
| `STORE_NAME`, `STORE_ID`, `STORE_HOST` | Shown in the header. Will come from the control plane once the portal reads the store registry |
| `APP_ENV=production` | Blocks demo data |

The engine must use bearer tokens (`authOptions.tokenMethod: 'bearer'`), as the cell configuration does.

## How sign-in works
1. `/login` posts the email and password to a server action, which calls the engine's `login` mutation.
2. The engine returns a bearer token. The portal stores it in an `httpOnly`, `secure`, `sameSite=lax` cookie (`osc_session`, 7 days). The browser never sees engine credentials and the portal holds no service account.
3. Every gateway call sends that token, so the engine applies the merchant's role and channel on each request. A missing or rejected session redirects to `/login`.
4. Middleware keeps signed-out visitors off every page except `/login` and the phone photo hand-off.

## What is live, and what is not
**Backed by the engine and tested against a real Vendure** (`services/engine/src/cell/portal-adapter.test.ts`, `apps/portal/scripts/live.cjs`):
orders list and detail, order filters and search, fulfilment with tracking, full and partial refunds through the Connect payment handler, products list, product detail and variants, add product, CSV import, stock adjustment for single-variant products, saving variant price, SKU, stock, VAT class, weight and on-sale, collections (list, preview, create), customers, overview and analytics figures computed from real orders, notifications derived from real orders and stock, the signed-in user's name.

**Not connected yet. These show an empty, honest state and refuse changes with a message; they never show fixtures:**
discounts, delivery zones, payment account status and onboarding, storefront theme and domain, content editing, legal pages, automations, team invitations and roles, service requests, email settings, preferences, billing invoices, live visitor analytics.

**Known limits**
- Adding or removing options on an existing product is refused (existing variants can be edited).
- Stock adjustment for multi-variant products is done per variant in the variant editor.
- Order numbers are the engine's order ids.
- The order's card brand and last four are not shown yet ("Not recorded").
- Notifications cannot be marked read; they clear when the underlying order or stock is dealt with.
- Product photos still use the demo upload path and are not stored in the engine's asset library.
- One store per deployment. Routing a signed-in merchant to their own cell through the control plane is not built.
- Variant prices are written as the customer pays them, which is correct when the channel's prices include tax. A cell whose channel excludes tax would need the conversion.

## What going live still needs (not code in this repository)
1. **A hosted engine cell.** Vendure needs a long-running Node server and worker, PostgreSQL and Redis. It cannot run on Vercel. Until one exists at a public HTTPS address there is nothing for `ENGINE_ADMIN_URL` to point to.
2. **An administrator account per merchant** on that cell, with a role limited to their channel (never SuperAdmin).
3. **Stripe**: live keys on the cell, the merchant's connected account onboarded, and Stripe's written confirmation of the fee arrangement.
4. **Vercel**: set the variables above on the portal project and remove `NEXT_PUBLIC_OSS_DEMO`.

## Trying it locally
```bash
cd services/engine && npx tsx proofs/dev-cell.ts
```
```bash
cd apps/portal && npx next build && ENGINE_ADMIN_URL=http://localhost:3050/admin-api STORE_NAME="Kiln & Thread" npx next start -p 3101
```
```bash
cd apps/portal && NODE_PATH=$(npm root -g) node scripts/live.cjs
```
Sign in as `owner@example.com` / `long-random-pass` (local test cell only).
