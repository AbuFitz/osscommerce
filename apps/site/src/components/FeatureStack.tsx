import { Bell, Check, Package, QrCode, Search, TrendingUp } from 'lucide-react';
import { Mark } from './Marks';

const gbp = (m: number) => `£${(m / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ORDERS = [['#1042', 'Maya Okafor', 'To fulfil', 2115], ['#1041', 'Tom Hendry', 'To fulfil', 6800], ['#1040', 'Priya Nair', 'Fulfilled', 12600], ['#1039', 'Callum Reid', 'Fulfilled', 2695]] as const;

/**
 * The hero showcase: the dashboard's main jobs laid out as layered panels in 3D space. It is a picture, not a control:
 * nothing in it reacts to the pointer, and it is described once for screen readers.
 */
export function FeatureStack() {
  return (
    <div className="stack" role="img" aria-label="The OneSimpleCommerce dashboard shown as layered panels: an orders list, a sales chart, stock levels, a payment received, and a notification">
      <div className="stack-in" aria-hidden>
        <div className="pn pn-orders"><div className="pn-h"><b>Orders</b><span>4 to fulfil</span></div>
          <ul>{ORDERS.map(([n, who, st, amt]) => <li key={n}><span className="pn-n">{n}</span><span>{who}</span><span className="pn-st" data-s={st === 'To fulfil' ? 'todo' : 'done'}><i />{st}</span><b>{gbp(amt)}</b></li>)}</ul></div>
        <div className="pn pn-sales"><span className="fc-k"><TrendingUp size={14} />Sales this week</span><b className="pn-big">£1,319.50</b><span className="fc-bars">{[38, 52, 30, 64, 48, 86, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} data-hi={i === 5 || undefined} />)}</span></div>
        <div className="pn pn-var"><span className="fc-k"><Package size={14} />Variants</span><span className="fc-line"><span>Small · Speckled</span><b>12</b></span><span className="fc-line"><span>Large · Speckled</span><b>9</b></span><span className="fc-line"><span>Large · Ocean</span><b data-low>2</b></span></div>
        <div className="pn pn-paid"><span className="fc-k">Payment received</span><span className="fc-row"><b className="pn-big">£68.00</b><Mark k="visa" /></span><span className="pn-ok"><Check size={14} />Paid · Order #1041</span></div>
        <div className="pn pn-pay"><span className="fc-k">Payout on its way</span><b className="pn-big">£412.80</b><span className="fc-row"><span className="fc-sub">To your bank, Friday</span><Mark k="stripe" mono /></span></div>
        <div className="pn pn-search"><Search size={15} /><span>Search orders, products, customers</span><kbd>Ctrl K</kbd></div>
        <div className="pn pn-qr"><QrCode size={34} /><span><b>Add photos from your phone</b>Scan, pick, done.</span></div>
        <div className="pn pn-note"><Bell size={15} /><span>Order #1040 dispatched</span><Check size={15} /></div>
      </div>
    </div>
  );
}
