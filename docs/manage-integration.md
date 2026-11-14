# OSS Manage ↔ Commerce integration contract

One OSS account and portal for the customer; separate ownership underneath. The Manage code and schema were **not inspected** in the session that wrote this, so this is the contract Manage must satisfy, not a description of it.

| Concern | Owner | Rule |
|---|---|---|
| Identity, sessions, MFA, organisation membership | Shared identity (reuse Manage auth if it can issue OIDC/JWT with `org`, `sub`, role claims) | Commerce never stores passwords |
| Contracts, invoices, support, renewals | Manage | Commerce reads entitlement only |
| Catalogue, orders, stock, shopper data, payment refs | Commerce cell | Manage never reads cell databases |
| Store registry, provisioning state | Control plane | No secrets; routed by verified hostname |

Flow: `Manage → entitlement.commerce.granted (signed, idempotent on eventId) → control plane provisions cell → store.lifecycle events back to Manage`. Both sides use the versioned schemas in `packages/contracts` and reconcile nightly. Portal navigation is composed from entitlements: no entitlement, no Commerce navigation.

Open discovery: Manage's auth mechanism, user/org tables, and whether it can be the OIDC issuer. Until then the portal runs against `DemoGateway` with an explicit demo banner-free fixture flag (`OSS_DEMO=1`).
