import { ShoppingBag, Search, Check } from 'lucide-react';

/** An illustrative storefront, built as real HTML so the text is real text. "Kiln & Thread" is our demo shop, not a client. Sizes use container units so it scales inside any frame. */
export function StoreDemo({ variant = 'desk' }: { variant?: 'desk' | 'phone' }) {
  return (
    <div className={`sd sd-${variant}`} role="img" aria-label="Demo storefront: a product page for a terracotta bud vase at £24, with glaze options and an add to bag button">
      <div className="sd-in" aria-hidden>
        <div className="sd-top"><span className="sd-logo">Kiln &amp; Thread</span><span className="sd-links"><i>Shop</i><i>Collections</i><i>Journal</i><i>About</i></span><span className="sd-ic"><Search /><ShoppingBag /></span></div>
        <div className="sd-body">
          <div className="sd-img"><img src="/img/vases.jpg" alt="" loading="lazy" /></div>
          <div className="sd-info">
            <span className="sd-crumb">Shop / Vases</span>
            <b className="sd-title">Bud vase, terracotta</b>
            <span className="sd-price">£24.00</span>
            <p>Thrown and glazed by hand in small batches. Each one is slightly different.</p>
            <span className="sd-lab">Glaze</span>
            <span className="sd-opts"><i data-on>Terracotta</i><i>Chalk</i><i>Sage</i></span>
            <span className="sd-cta">Add to bag</span>
            <span className="sd-note"><Check />In stock. Dispatched in 2 working days.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
