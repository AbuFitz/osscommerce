# ADR 0002: Fee refunds, abandoned-checkout consent, Plus commission

Status: accepted (pricing remains provisional until the commercial agreement template is reviewed by a solicitor)

## 1. Our fee is returned on refunds, by default
Refunds return our application fee in proportion to the amount refunded (`feeRefundMinor`, floor-rounded). Implemented as Stripe `refund_application_fee: true` on direct charges, so the merchant is never charged for a sale that was reversed. It is a per-agreement flag (`FeeSchedule.refundsReturnFee`, default `true`) so a negotiated deal can differ, and the portal refund dialog shows the returned amount before the merchant confirms. Cost to OSS is small (0.5% of refunded value) and removes the most common merchant objection to a platform fee.

## 2. Abandoned-checkout email requires explicit opt-in
Soft opt-in under PECR reg. 22 covers existing customers buying similar goods; it does not cover a shopper who never completed a purchase. So the checkout carries an unticked, separate consent for reminders, and the automation engine checks the live consent record at send time (not at scheduling time). A withdrawn consent, a suppression entry, quiet hours, a throttle and the monthly allowance each stop the send. Transactional email (order, dispatch, refund, payment failed, password reset) is never gated by marketing consent. The ICO's guidance on this area is under review, so the stance is the conservative one and is recorded here to be revisited.

## 3. Plus commission: 0.3%, falling to 0.2% from £100,000 a month
Commerce is 0.5%. Plus is 0.3% with a 0.2% tier above £100k monthly volume. Break-even where Plus (£99 + 0.3%) becomes cheaper than Commerce (£49.99 + 0.5%) is about £24,505 a month; see `docs/economics/results.md` and `docs/economics/model.mjs`. Card-processing costs are passed through by Stripe on the merchant's own account, so the commission is our only variable revenue and is not eroded by processing cost.

## Consequences
- Fee logic lives in `packages/contracts` only; the cell, portal and site import it.
- Changing any of these is a data change on the plan or agreement, not a code change.
