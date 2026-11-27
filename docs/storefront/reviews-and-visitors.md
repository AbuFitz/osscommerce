# Reviews and visitor counts, for storefront builders

Both go through the same authenticated gateway as everything else. Use the SDK from your storefront **server** (route handlers, middleware, server actions), never from the browser.

## Visitor counts (no cookies)

```ts
import { createClient } from '@oss-commerce/storefront-sdk';
const oss = createClient(config);

// In middleware or a route handler, once per page view the shopper makes:
await oss.trackVisit(
  { kind: 'page', path: new URL(req.url).pathname, referrer: req.headers.get('referer') ?? undefined, width: Number(viewportWidthIfKnown) || undefined },
  { ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), agent: req.headers.get('user-agent') ?? undefined },
);
```

- `kind` is `page`, `product` (a product page), `cart`, `checkout` or `purchase`. Send `product` instead of `page` on product pages, and `purchase` on the order-confirmed page. These are the funnel steps the merchant sees.
- `trackVisit` never throws and is never retried, so a failure cannot break a page or double-count.
- Nothing is stored on the shopper's device. A visitor is recognised for one day by a hash that cannot be linked across days; the address and browser are not stored; hashes are deleted after two days. Query strings and long ids are removed from paths.
- Robots (`bot`, `crawler`, `headless`…) are ignored. Rate-limited requests are accepted and ignored.
- This is measurement that does not read from or write to the device, so it does not set a cookie banner requirement by itself. Have your legal adviser confirm that for the merchant's own privacy policy.

## Reviews

```ts
const { summary, items, hasMore } = await oss.productReviews(productId, { take: 10, skip: 0 });
// summary.average is rounded to one decimal; items are approved reviews only; each may have a merchant `reply`.

await oss.submitReview({ productId, rating: 5, title, body, name, email }, { ip, agent });
// One review per email per product. It waits for the merchant to approve; tell the shopper that.
```

- **Render review text as text, never as HTML.** Reviews are stored exactly as typed.
- `verified` means that email has a paid order containing the product.
- The reviewer's email is never returned to shoppers.
- Rate limits apply per address and per email; pass the shopper's address so one person cannot flood a store.
