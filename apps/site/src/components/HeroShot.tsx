import { Display, IPhone } from './Devices';
import { StorefrontPage } from './StorefrontPage';
import { Check, Package } from 'lucide-react';

/**
 * Hero "shot": a composed product scene in the manner of a studio mockup. Devices are live DOM (razor-sharp text), tilted a measured
 * amount; glass widgets float over them; the ceramics are a pre-rendered cut-out. No WebGL, so nothing depends on the visitor's GPU.
 * Desktop shows display + phone + widgets. Mobile shows the phone as the hero, with two widgets and the product.
 */
export function HeroShot() {
  return (
    <div className="shot" aria-hidden>
      <div className="shot-in">
        <div className="shot-display"><Display><StorefrontPage v="ceramics" /></Display></div>
        <div className="shot-phone"><IPhone><StorefrontPage v="ceramics" mobile /></IPhone></div>
        <div className="shot-ceramics"><img src="/renders/ceramics-cutout.webp" alt="" width={1248} height={647} decoding="async" fetchPriority="high" /></div>

        <div className="pw glass-w shot-toast"><span className="ok"><Package size={16} aria-hidden /></span><div><b>New order · #1043</b><small>£42.00 · Paid to your Stripe account</small></div></div>
        <div className="pw dark shot-status">
          <div className="pw-h"><b>Order status</b><span>24 orders</span></div>
          <div className="dials">{[['17', 'To fulfil', '#e4f55e', 17], ['75', 'Fulfilled', '#b9d3ee', 75], ['8', 'Cancelled', '#e8764a', 8]].map(([n, l, c, p]) => (
            <div className="dial" key={l as string}><b>{n}<small>%</small></b>
              <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth=".6" strokeDasharray="1 2" /><circle cx="16" cy="16" r="11" fill="rgba(255,255,255,.07)" /><circle cx="16" cy="16" r="6.25" fill="none" stroke={c as string} strokeWidth="12.5" strokeDasharray={`${(p as number) / 100 * 19.6} 40`} transform="rotate(-90 16 16)" /></svg>
              <span>{l}</span></div>))}</div>
        </div>
        <div className="pw glass-w shot-ok"><span className="ok"><Check size={16} aria-hidden /></span><div><b>Checkout healthy</b><small>Checked 2 min ago</small></div></div>
      </div>
    </div>
  );
}
