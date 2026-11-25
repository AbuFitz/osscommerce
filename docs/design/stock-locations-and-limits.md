# Stock locations, and the known limits of Phase 2

## Stock in more than one place: researched, deliberately not built yet

**What Vendure already provides** (checked in `@vendure/core` 3.x source, not assumed):
- `StockLocation` entities with admin API `stockLocations` / `createStockLocation`, and a `StockLevel` per variant per location.
- A pluggable `StockLocationStrategy` with `getAvailableStock`, `forAllocation`, `forRelease`, `forSale`, `forCancellation`. The default strategy uses one location. A `MultiChannelStockLocationStrategy` ships for one location per channel.
- No built-in transfer between locations, no purchase orders.

**What building it here would take** (roughly a focused day, no new engine):
1. A custom strategy (for example: sell from the location with most stock, or a merchant-set priority order). About 40 lines and a unit test.
2. Portal: a Locations list, a per-location count on the item page, and a Transfer dialog. A transfer is two reasoned adjustments (out of one, into the other) written together, so history shows both sides.
3. Tenancy: `stockLocations` is already read-only to merchants; creating one would be added to the guard with an ownership check.

**Why not now:** the stores this platform serves (makers, trades, small shops) keep stock in one place. Adding locations everywhere in the UI makes every merchant's screens busier for a few merchants' benefit.

**Trigger to build:** the first real merchant who says they stock from more than one place. Until then the item page stays one number.

## Limits that remain, and why

- **A further increase right after a refund is refused** until the refund shows as settled. Vendure checks that the unpaid amount equals the sum of unsettled modifications, and a pending refund breaks that equality. Stripe refunds can be pending for a short time. The message says so plainly. A future fix is to wait for the Stripe refund webhook before offering the edit.
- **An extra amount on an edited order is recorded, not charged.** The merchant says how they were paid (cash, card in person, bank transfer, other). Charging the customer's saved card, or sending a payment link, needs Stripe wiring that has not been switched on yet.
- **Postcode zones that overlap each other are not ranked.** A catch-all zone defers to every postcode zone (exclusions are kept in step on every save), but two postcode zones that both cover an area are both offered. Keep postcode zones distinct.
- **Names that are both a country and a postcode area** (IM, JE, GY) are read as the country, because that is what the customer's address will say.
- **Weight rules depend on product weights.** Items without a weight count as zero. The Shipping page says how many items have no weight whenever a weight rule exists.
- **Stock history reasons live in the variant's `stockLog`** because Vendure has no reason field on movements. They are matched to movements by time and quantity; changes made outside the portal show "no reason recorded".

## Closed since the Phase 2 start
- Stock history is paged (50 at a time) instead of cut at 100.
- Every reservation, sale, release and cancellation names its order. Vendure declares `Allocation.orderLine` non-null although some rows have none, and does not expose it on sales, so the cell adds a safe nullable `orderRef` to each movement type.
- An edit left part-way (lost connection, closed tab) can be finished from a banner on the order.
