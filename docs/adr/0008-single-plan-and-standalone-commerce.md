# ADR 0008: one plan, and Commerce as a standalone product

Date: 15 November 2026. Status: accepted, with open items below.

## Decisions
1. **One plan.** £479 one-off storefront build, £39 a month. The two-tier plans (£49.99 and £99; £699 and £1,499 builds) are retired. The single source is `packages/contracts/src/plans.ts` (`LAUNCH_PLAN`); the marketing site and the portal's Plan and billing page read it.
2. **Commerce is standalone.** The portal no longer hands off to an "OSS account" for website, billing or support. Plan and billing lives at `/account/billing`; help and requests stay in the portal. `NEXT_PUBLIC_OSS_MANAGE_URL` is removed.
3. **Two money flows stay separate.** The merchant's subscription is billed by OneSimpleSite's own Stripe account (`gateway.billing()`); customer payments go to the merchant's Stripe Connect account (`gateway.paymentSetup()`). No code path mixes them.
4. **Marketing site rebuilt** (`apps/site`): Funnel Display, Hanken Grotesk and DM Mono as on onesimplesite.co.uk; real dashboard captures; enquiries stored in `cp.enquiries` through an insert-only role (migration 0008).

## Open, needs the owner's decision before launch
- **Application fee.** 0.5% (`baseBp: 50`) remains in the plan data but is not confirmed (`COMMERCIAL_CONFIRMED.applicationFee = false`), so the site states no rate.
- **VAT.** Whether £479 and £39 include VAT. No VAT number is on record.
- **Build scope and support allowance.** The site describes them in general terms; the order form must define them.
- **Existing Stripe products and subscriptions** were not touched. If any exist at the old prices they need changing by hand.
- **Subscription billing is connected after provisioning.** The live portal reads the store's platform Stripe subscription and hosted invoices through a separately scoped billing key. A recently authenticated merchant can open Stripe's hosted Billing Portal to manage their payment method; creating subscriptions remains an operator-managed workflow.
- **Merchant sign-in is not built.** The site hides "Sign in" until `NEXT_PUBLIC_PORTAL_URL` is set.
- **Enquiries are stored but nobody is notified.** Add an email or an operations view before relying on the form. Retention period undecided.
- **Migration 0008 is applied only to the local test database**, not to Neon dev or staging.
- **Terms of Service clause 3** still mentions a platform fee on payments; align it once the fee is decided.
