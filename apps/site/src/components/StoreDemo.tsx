import { ShoppingBag, Search, Check } from 'lucide-react';

/** A neutral storefront layout, built as HTML. It stands in for a store that does not exist yet: every real one is designed around the merchant's own brand and photography, so no product imagery is invented here. */
export function StoreDemo({ variant = 'desk' }: { variant?: 'desk' | 'phone' }) {
  return (
    <div className={`sd sd-${variant}`} role="img" aria-label="Storefront layout: a product page with a photo area, product name, price, size options and an add to bag button">
      <div className="sd-in" aria-hidden>
        <div className="sd-top"><span className="sd-logo">Your brand</span><span className="sd-links"><i>Shop</i><i>Collections</i><i>Journal</i><i>About</i></span><span className="sd-ic"><Search /><ShoppingBag /></span></div>
        <div className="sd-body">
          <div className="sd-img sd-ph"><span>Your photography</span></div>
          <div className="sd-info">
            <span className="sd-crumb">Shop / Collection</span>
            <b className="sd-title">Your product</b>
            <span className="sd-price">£24.00</span>
            <p>Your own words about what makes it worth buying.</p>
            <span className="sd-lab">Size</span>
            <span className="sd-opts"><i data-on>Small</i><i>Medium</i><i>Large</i></span>
            <span className="sd-cta">Add to bag</span>
            <span className="sd-note"><Check />In stock. Dispatched in 2 working days.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
