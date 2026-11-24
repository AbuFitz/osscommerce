# Building a storefront

## Environment contract
| Variable | Public | Purpose |
|---|---|---|
| `OSS_COMMERCE_API_URL` | no (server) | Gateway base URL. https outside development. |
| `OSS_STORE_ID` | no | Merchant store this storefront belongs to. |
| `OSS_STOREFRONT_ID` | no | This connection's id. Must match the credential. |
| `OSS_ENV` | no | `development`, `preview`, `staging` or `production`. Only production takes live orders. |
| `OSS_STOREFRONT_SERVER_SECRET` | **never** | 256-bit secret identifying this storefront to the gateway. |
| `OSS_REVALIDATION_SECRET` | **never** | Verifies signed cache events. Must differ from the server secret. |
| `OSS_SITE_URL` | no | Canonical URL. Production must be the merchant's own domain. |

`loadConfig()` refuses to start if anything is missing, inconsistent, or if a secret-looking variable is prefixed `NEXT_PUBLIC_`. There is no default store or channel. Provisioning writes these to Vercel; the two secrets go in as sensitive variables and appear nowhere else.

## Journey and where each step lives
1. Create store and storefront records: control plane (`cp.stores`, `cp.storefronts`).
2. Provision project, credentials, env, domain: `packages/provisioning` (resumable).
3. Build the site with `@oss-commerce/storefront-sdk`: config, `createClient`, tags, `handleRevalidation`, content manifest.
4. Connect: gateway resolves the credential; compatibility is checked with `checkCompatibility`.
5. Content: declare a manifest; the portal edits it; the site reads a published entry with `client.content(entry)`. Legal pages use `legal/privacy`, `legal/terms`, `legal/shipping` and `legal/returns`. Validate the returned `body` against the local manifest before rendering it.
6. Launch: a production storefront moves `connected` -> `approved` -> `live`; only one live production storefront per store.

## Rules for storefront code
- Call the commerce API only from server code (server components, route handlers, server actions).
- Keep the shopper session in an HttpOnly cookie set by a same-origin route. Never put it in `localStorage` or a `NEXT_PUBLIC_` variable.
- Cache only public catalogue and content, tagged with `tag(storeId, ...)`. Never cache cart, checkout, customer or order responses.
- Mutations that must not duplicate (add payment, place order) pass an idempotency key.
