# ADR 0005: Merchant payments, the financial ledger and the integration framework

Status: accepted for what is built; items marked "to confirm" need written confirmation from the provider before launch

## Connected-account model (`packages/payments/src/connect.ts`, `ACCOUNT_MODEL`)
One OSS platform account; one connected account per merchant legal entity; one store maps to one account (primary key and unique constraint in `cp.payment_accounts`, so an account can never be bound to two stores).
- **Direct charges** on the connected account (`Stripe-Account` on every call). The merchant is merchant of record and receives proceeds straight to their bank; OSS receives only `application_fee_amount`.
- **Fees paid by the account, losses by Stripe, full Dashboard, embedded onboarding** (hosted onboarding as fallback). Stripe's design guide describes this as the usual default for software platforms: Stripe monitors risk and recovers negative balances. To confirm: our eligibility for Stripe-handled pricing and Stripe bearing negative-balance liability. The dashboard type is immutable per account, so this is a one-way choice for each merchant.
- **API version.** Stripe's guide marks the controller-property integration (Accounts v1) as legacy for existing platforms and directs new platforms to Accounts v2. The `ConnectPort` hides this; the live adapter must be written against whichever version the OSS platform account is created on. To confirm before the adapter is written.
- Existing Stripe accounts: supported only through Stripe's own authorisation flow, never passwords. An account already connected to another platform may need a new account under the same login.

## Merchant experience and safety
- **Readiness comes from Stripe's account state, not a redirect.** `readiness()` maps charges, payouts, requirements, deadlines and disabled reasons to eight statuses (`not_started`, `onboarding`, `pending_verification`, `action_required`, `restricted`, `enabled`, `payouts_paused`, `disconnected`). Payments-enabled and payouts-enabled are separate. Checkout is allowed only when Stripe reports charges enabled; existing orders, refunds and reconciliation stay available when it is not.
- **Account Sessions** are created server-side. The account always comes from OUR registry for the caller's store, the component list is an allowlist, and components that change who gets paid (`account_management`, `account_onboarding`) need the store owner plus a password re-confirmation in the last 10 minutes. Every session is audited.
- **Apple Pay, Google Pay and Link** need each checkout domain registered on the connected account through the Payment Method Domains API (Stripe: Connect direct charges must use the API, not the Dashboard). `registerCheckoutDomain` runs when a storefront domain is verified.

## Checkout (cell)
- `createPaymentSession` (Shop API) derives amount, currency, fee and account from the shopper's own active order. It requires the order to be in `ArrangingPayment` with a delivery method; the browser sends nothing financial.
- `addPaymentToOrder` re-reads the PaymentIntent from Stripe and requires: it belongs to this order, currency and amount match, our application fee matches the agreement, and Stripe says it succeeded. A payment for another order, a changed amount or an unpaid intent is declined.
- Proven against a real Vendure server in `boot.test.ts`, including the event that follows (below).
- We still do not use `@vendure/payments-plugin`: it was reviewed for ADR 0001 and does not provide the per-request connected-account context, fee rules and verification above; we did not re-verify against its latest release. Revisit only if upstream adds first-class Connect support.

## Events and the outbox
Order transitions to paid, shipped or cancelled are written to an outbox table in the cell's own database and delivered, signed, to the control plane (`handleIngest`), which de-duplicates on event id and refuses events for any store other than the cell's. A periodic sweep re-derives events for settled orders that have none, so a crash between the order commit and the subscriber loses nothing. Critical emails hang off these events, not off the browser.

## Financial ledger and reconciliation
`cp.ledger_entries` is append-only (trigger), keyed by the provider's balance-transaction id so re-imports cannot double count, and splits Stripe's fee from the OSS application fee. `reconcile()` compares orders with the ledger and names each drift: `missing_in_ledger`, `missing_in_orders`, `amount_mismatch`, `refund_mismatch`, `fee_mismatch`. Refund fee handling is the explicit per-agreement policy from ADR 0002, never assumed.

## Integration framework (`packages/integrations`)
- **Manifest first.** Each provider is a validated manifest (region, auth, capabilities, who pays, allowed hosts, rate limit, webhooks). A provider cannot be `available` until docs are reviewed, sandbox proof exists, provider approval is held where needed, regions and pricing are verified, and security and failure-handling tests pass. Today every provider is `research`, `planned` or `building`; the portal must show none as connectable.
- **Connections are tenant-scoped, state-machine driven and checked for real**: available, configuring, pending, connected, degraded (after three consecutive failed health checks), revoked, disabled. A health check never revives a revoked or disabled connection.
- **Credentials** are sealed with AES-256-GCM, bound to store and connection as authenticated data, versioned for key rotation, and never logged. Provider errors are redacted before storage.
- **Adapters** receive plain data and run in the durable job queue; they may call only the https hosts in their manifest (SSRF guard).

## Automation
Own rule engine on pg-boss (ADR 0003) covers the first needs: paid-order notifications, low stock, dispatch emails, fulfilment reminders, consent-gated abandoned checkout. Activepieces, Windmill, Trigger.dev and React Flow were identified in the research brief; their licences and embedding terms were NOT verified here, so none is adopted. A visual rule builder is future work; React Flow is the leading candidate for the canvas.

## Not built yet
Live Stripe adapter and Connect.js UI in the portal; Stripe webhook handling for `account.updated` into `cp.payment_accounts`; payout, balance and dispute screens; the OSS console views; any provider adapter; the Payment Element and Express Checkout front end (the server side above is ready for it).
