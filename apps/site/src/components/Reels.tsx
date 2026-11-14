'use client';
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/** Starts a looping CSS animation only while the piece is on screen. Reduced motion shows the finished state (see globals.css). */
function Reel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null); const [on, setOn] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.35 }); io.observe(el); return () => io.disconnect(); }, []);
  return <div ref={ref} className={`glass reel ${className}`} data-play={on}>{children}</div>;
}

const ROWS = [['#1043', 'Maya O.', '£42.00', 'r1'], ['#1044', 'Tom H.', '£68.00', 'r2'], ['#1045', 'Priya N.', '£126.00', 'r3']] as const;
export function OrdersReel() {
  return (
    <Reel>
      <div className="rl-head"><h3>Orders</h3><span>Today</span></div>
      {ROWS.map(([n, who, amt, cls]) => (
        <div key={n} className={`rl-row ${cls}`}><b>{n} · {who}</b><span className="rl-st"><span className="a">Paid</span><span className="b">Packed</span><span className="c">Shipped</span></span><small>{amt}</small><small style={{ textAlign: 'right' }}>Tracking sent to customer</small></div>
      ))}
      <div className="toast-m"><Check size={14} style={{ verticalAlign: '-2px' }} aria-hidden /> Paid straight to your own Stripe account</div>
      <p className="cap">Orders arrive, get packed and shipped, and every step is tracked. Sample data.</p>
    </Reel>
  );
}
export function ContentReel() {
  return (
    <Reel>
      <div className="rl-head"><h3>Homepage</h3><span>Draft</span></div>
      <div className="ed">
        <div><label>Headline</label><div className="fld"><span className="type">New season, now in.</span></div></div>
        <div><label>Image</label><div className="fld" style={{ color: '#9aa095' }}>Choose from your library</div></div>
      </div>
      <div className="prev"><div className="h1">Spring collection</div><div className="h2">New season, now in.</div></div>
      <span className="pubbtn">Publish</span>
      <div className="live-m">Live on your storefront</div>
      <p className="cap">Edit structured fields and preview before you publish. The design we built for you stays intact.</p>
    </Reel>
  );
}
export function CheckoutReel() {
  return (
    <Reel>
      <div className="rl-head"><h3>Checkout</h3><span>Secure</span></div>
      <div className="co">
        <div className="sum"><span>2 items</span><b>£58.00</b></div>
        <div className="sum"><span>Delivery · Tracked</span><b>£3.95</b></div>
        <div className="xp"><span>Apple Pay</span><span>Google Pay</span><span>Link</span></div>
        <div className="note">Express checkout appears where the customer&rsquo;s device and region support it.</div>
        <div className="ok-m"><Check size={18} aria-hidden /><div><b>Order confirmed</b><div style={{ fontSize: 13 }}>Receipt on its way</div></div></div>
      </div>
      <p className="cap">Guest checkout, saved details, accurate delivery and tax, and a clear confirmation.</p>
    </Reel>
  );
}
