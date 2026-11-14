'use client';
import { useState } from 'react';
import { Toggle } from '@oss-commerce/ui';
import { PRICING } from '@/config';

const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Compares fees you enter yourself. We deliberately do not state any competitor's prices. */
export function PricingCalc() {
  const [sales, setSales] = useState(4000);
  const [fee, setFee] = useState(2);
  const [plan, setPlan] = useState(35);
  const [vat, setVat] = useState(false);
  const k = vat ? 1 + PRICING.vatRate : 1;
  const monthly = PRICING.monthlyGbp * k;
  const platform = sales * (PRICING.platformFeeBp / 10000) * k;
  const ours = monthly + platform;
  const yours = plan + sales * (fee / 100);
  const diff = yours - ours;
  return (
    <div className="calc">
      <div className="card in">
        <div className="field"><label htmlFor="c-s">Monthly online sales</label>
          <input id="c-s" type="number" inputMode="numeric" min={0} max={200000} step={100} value={sales} onChange={e => setSales(clamp(+e.target.value, 0, 200000))} />
          <input className="range" type="range" min={0} max={30000} step={250} value={Math.min(sales, 30000)} onChange={e => setSales(+e.target.value)} aria-label="Monthly online sales slider" /></div>
        <div className="row2">
          <div className="field"><label htmlFor="c-f">Your platform's fee per sale (%)</label><input id="c-f" type="number" inputMode="decimal" min={0} max={20} step={0.1} value={fee} onChange={e => setFee(clamp(+e.target.value, 0, 20))} /><small>Not the card fee. Only what the platform adds.</small></div>
          <div className="field"><label htmlFor="c-p">Your monthly plan (£)</label><input id="c-p" type="number" inputMode="decimal" min={0} max={2000} step={1} value={plan} onChange={e => setPlan(clamp(+e.target.value, 0, 2000))} /><small>Plus any paid apps you rely on.</small></div>
        </div>
        <Toggle label="Show our prices including VAT" description="Our prices are quoted excluding VAT." checked={vat} onChange={setVat} />
        <p className="muted" style={{ fontSize: 13.5 }}>The starting numbers are examples. Change them to match your own. Card processing fees are charged by Stripe on your account either way, so they are left out of both sides.</p>
      </div>
      <div className="receipt" aria-live="polite">
        <div className="muted" style={{ color: '#9fc4b1' }}>With Commerce, each month</div>
        <dl>
          <dt>Managed commerce</dt><dd className="num">{gbp(monthly)}</dd>
          <dt>Platform fee ({(PRICING.platformFeeBp / 100).toFixed(1)}% of {gbp(sales)})</dt><dd className="num">{gbp(platform)}</dd>
          <hr />
          <dt>Total</dt><dd className="num big">{gbp(ours)}</dd>
        </dl>
        <div className="muted" style={{ color: '#9fc4b1', marginTop: 6 }}>Your current platform</div>
        <dl><dt>Plan and per-sale fee</dt><dd className="num">{gbp(yours)}</dd></dl>
        <p style={{ marginTop: 6, fontSize: 18, fontWeight: 560, letterSpacing: '-.02em' }}>
          {diff > 0.5 ? `About ${gbp(diff)} a month less than you pay now.` : diff < -0.5 ? `About ${gbp(-diff)} a month more than you pay now. You would be paying for a custom storefront and a team, not just software.` : 'About the same as you pay now.'}
        </p>
        <p className="muted" style={{ color: '#9fc4b1', fontSize: 13 }}>An estimate for comparison, not a quote. The storefront build is priced separately.</p>
      </div>
    </div>
  );
}
