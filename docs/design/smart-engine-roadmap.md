# Smart engine roadmap: what merchants get without setting anything up

Principle: the merchant says what they sell in plain terms; the platform derives the rest. No rule builders, no scripting. Each feature ships with a sensible default and one switch.

## Built
- **Packs and singles** (`packages/inventory`): one product sold in several formats (single, pack of 6, case of 24) drawing on one stock. Two modes: *pooled* (count singles; packs are virtual and update themselves) and *sealed* (packs held on the shelf; selling singles opens a pack automatically when loose stock runs out and tells the merchant). Emits `stock.pack_broken`, `stock.low`, `stock.out`. 13 tests. Pure logic: not yet connected to the engine or the portal.

## Next, in order of merchant value
1. **Connect packs/singles to the engine and portal.** A per-product "Sold as" setting (single / pack / case, mode, auto-open) stored on the variant; engine applies `sell` on order placement and writes the stock movements; the portal shows one stock figure per format and a "pack opened" activity entry. Needs a Vendure plugin (stock movement listener + custom fields) and a migration.
2. **Smart stock alerts.** Low-stock level suggested from sales speed ("about 9 days left"), not a number the merchant has to guess; one daily digest instead of many emails.
3. **Reorder helper.** Suggested restock quantity per supplier lead time; one-tap purchase-order email to the supplier.
4. **Automation actions beyond email.** Today rules only send email. Add: hide a product when out of stock, show "back in stock" signup, apply a discount to slow stock, tag a customer. Same rule model, new action types, each audited and reversible.
5. **Made-to-order and personalised products**: option sets with price rules and a production sheet on each order (the candle example on the marketing site).
6. **Delivery rules by postcode/weight/value**, free-delivery windows, click-and-collect slots, local fitting areas.
7. **Subscriptions and repeat orders** (coffee, consumables): schedule, skip, pause, one payment method on file.
8. **Wholesale / trade pricing**: customer groups with their own prices and minimums.
9. **Back-office safety**: bulk edit with preview, undo for stock and price changes, stock count mode (scan and reconcile), an activity log per product.
10. **Insights written in words**: "Streetwear hoodie sold 3x last week; 4 left; reorder?" instead of dashboards to interpret.

## Rules for every smart feature
- Default on only if it cannot surprise the merchant or the shopper; otherwise a clear one-line prompt to turn it on.
- Every automatic change is logged where the merchant can see it and undo it.
- Stock changes are idempotent per order event, so a retried webhook never double-counts.
- Runs inside the store's own channel; no feature may read or change another store's data.
