# ADR 0009: OneSimpleCommerce brand, integrated payments and fee presentation

Date: 15 November 2026. Status: accepted; items under "Open" are not done.

## Decisions (owner)
- The product is **OneSimpleCommerce** ("onesimplecommerce."), a product by OneSimpleSite.
- Commercial offer: £479 one-time build, £39 a month, and payment costs that include a **0.5% application fee**. OneSimpleSite Ltd is **not VAT registered**, so prices are final and no VAT is added.
- Payments are presented as a native part of the product (as Shopify Payments is to Shopify), powered by Stripe Connect. The merchant sees **one combined cost per payment and the net they receive**, with the make-up available. The fee is disclosed on the pricing page and must be in the merchant agreement.
- Architecture unchanged: direct charges on the merchant's connected account, application fee on each charge, Stripe-managed liability and pricing. OneSimpleSite never holds merchant funds.

## What is built
- `packages/contracts/src/fees.ts`: a rate card as data (per payment category, currency conversion, dispute fee, refund behaviour), `paymentCost`, `combinedRate`, `refundEffect`, with tests. No universal rate is hardcoded.
- Marketing site: brand, dark gradient system, 3D hero scene, payment orbit, WhatsApp contact, three-step sign-up, payment cost table driven by the rate card.

## Research
- Stripe UK published pricing, read 15 Nov 2026 (stripe.com/gb/pricing): UK standard cards 1.5% + 20p; UK premium cards 2.8% + 20p; EEA cards 2.5% + 20p; international cards 3.15% + 20p; +2% if currency conversion is needed; £20 per dispute received; no fee to refund, and the original processing fee is not returned; Klarna from 4.99% + 35p. Where Stripe sets and collects processing fees from connected accounts, Connect is "included"; platforms that set their own payments pricing pay from 0.25%.
- Connect embedded components available (docs.stripe.com/connect/supported-embedded-components): account onboarding, account management, notification banner, payments, payment details, disputes, payment method settings, payouts, balances, payouts list, payout details, documents, balance report, payout reconciliation report.

## Recommendation for the merchant Payments area (not built yet)
Our own Payments pages for the parts where we add meaning (net proceeds, combined cost, order links), and Stripe embedded components for the regulated or sensitive parts: onboarding, account management, notification banner, payout destination and disputes. This needs an Account Session endpoint and the `@stripe/connect-js` packages.

## Open
- **Confirm with Stripe in writing** that processing fees are charged to connected accounts at these rates under our configuration, and that presenting a combined rate is acceptable under their branding and pricing-disclosure rules. Until then `PROCESSOR_RATES_CONFIRMED` is false and the site labels the rates as Stripe's published pricing on a stated date.
- Merchant Payments area in the portal: transactions with cost and net, payouts, balance, rates, disputes. Not started.
- Terms of Service clause 3 must state the 0.5% fee and how it is collected.
- Sign-up collects details and stores an enquiry. It does not create a login; merchant authentication is not built.
- Migration 0008 (enquiries) is still only on the local test database.
