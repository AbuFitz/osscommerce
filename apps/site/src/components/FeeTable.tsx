import { STRIPE_UK_RATE_CARD as CARD, PROCESSOR_RATES_CONFIRMED, combinedRate, paymentCost, LAUNCH_PLAN } from '@oss-commerce/contracts';
const gbp = (m: number) => `£${(m / 100).toFixed(2)}`;
const BP = LAUNCH_PLAN.fee.baseBp;
/** Payment costs as one combined rate per kind of payment, with the make-up one click away. Figures come from the shared rate card, never from this page. */
export function FeeTable() {
  const ex = paymentCost({ amountMinor: 5000, category: 'uk_standard', applicationFeeBp: BP }); const live = CARD.rates.filter(r => r.category !== 'klarna');
  return (<div className="fee">
    <div className="fee-ex"><p className="mono">A £50 ORDER PAID WITH A UK CARD</p>
      <dl><div><dt>Customer pays</dt><dd>{gbp(ex.grossMinor)}</dd></div><div><dt>Payment cost ({combinedRate('uk_standard', BP).text})</dt><dd>−{gbp(ex.totalFeeMinor)}</dd></div><div className="tot"><dt>You receive</dt><dd className="fig">{gbp(ex.netMinor)}</dd></div></dl>
      <p className="fee-fine">Paid out to your bank by Stripe.</p></div>
    <div className="fee-rates"><table><caption className="sr">Payment costs by card type</caption>
      <thead><tr><th scope="col">Payment</th><th scope="col">Cost per payment</th></tr></thead>
      <tbody>{live.map(r => { const c = combinedRate(r.category, BP); return <tr key={r.category}><th scope="row"><b>{r.label}</b><span>{r.detail}</span></th><td><b className="fig">{c.text}</b><span>{c.processorText} processing + {c.platformText} platform</span></td></tr>; })}
        <tr><th scope="row"><b>Currency conversion</b><span>When a customer pays in another currency</span></th><td><b className="fig">+{CARD.currencyConversionBp / 100}%</b></td></tr>
        <tr><th scope="row"><b>Refunds</b><span>No charge to refund. The processing part of the original cost is not returned; our {BP / 100}% is.</span></th><td><b className="fig">£0</b></td></tr>
        <tr><th scope="row"><b>Disputes</b><span>Charged by Stripe if a customer disputes a payment with their bank</span></th><td><b className="fig">{gbp(CARD.disputeFeeMinor)}</b></td></tr></tbody></table>
      <p className="fee-fine">Each cost is Stripe's processing rate plus the {BP / 100}% OneSimpleCommerce platform fee, taken together when the payment is made. {PROCESSOR_RATES_CONFIRMED ? '' : `Processing rates are Stripe's published UK pricing as of ${new Date(CARD.checkedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} and can change; your order form states the rates that apply to you.`}</p></div>
  </div>);
}
