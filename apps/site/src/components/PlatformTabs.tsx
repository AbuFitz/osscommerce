'use client';
import { useId, useState } from 'react';
import { Browser, Shot } from './Frames';

const TABS = [
  { k: 'orders', t: 'Orders', d: 'Every order in one list, with payment and fulfilment status. Open one to see items, the customer, the payment and a timeline.', alt: 'Orders list in the OneSimpleCommerce dashboard' },
  { k: 'order', t: 'Fulfilment and refunds', d: 'Mark an order as fulfilled with tracking, or refund all or part of it. The customer is told by email.', alt: 'A single order with fulfil and refund actions' },
  { k: 'product', t: 'Products and variants', d: 'Add products with sizes, colours and other options. Each variant has its own SKU, price and stock.', alt: 'A product with its variants' },
  { k: 'inventory', t: 'Stock', d: 'See what is on hand, what is reserved for open orders and what is running low. Adjust with a reason, so there is a record.', alt: 'Inventory screen with stock levels' },
  { k: 'analytics', t: 'Sales', d: 'Sales by day, net of refunds, with your best sellers and order status at a glance.', alt: 'Analytics screen with sales by day' },
  { k: 'shipping', t: 'Delivery', d: 'Set delivery zones and prices, offer free delivery over an amount, and check which zone any postcode falls in.', alt: 'Shipping zones and rates' },
] as const;

/** Real captures of the dashboard, switched in place. Arrow keys move between tabs. */
export function PlatformTabs() {
  const id = useId(); const [i, setI] = useState(0);
  const key = (e: React.KeyboardEvent) => { const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = (i + d + TABS.length) % TABS.length; setI(n); document.getElementById(`${id}-t${n}`)?.focus(); };
  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label="Parts of the dashboard" onKeyDown={key}>
        {TABS.map((t, n) => <button key={t.k} id={`${id}-t${n}`} role="tab" type="button" aria-selected={n === i} aria-controls={`${id}-p`} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}><b>{t.t}</b><span>{t.d}</span></button>)}
      </div>
      <div className="tabpanel" id={`${id}-p`} role="tabpanel" aria-labelledby={`${id}-t${i}`}>
        <Browser><Shot key={TABS[i].k} name={TABS[i].k} alt={TABS[i].alt} /></Browser>
        <p className="tabcap">{TABS[i].d}</p>
        <p className="tabnote">The real dashboard, shown with demo data.</p>
      </div>
    </div>
  );
}
