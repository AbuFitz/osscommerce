// Unit economics per merchant per month, GBP. Run: node docs/economics/model.mjs
// Sources checked 14 Nov 2026: Neon pricing, Railway pricing, Stripe Connect UK pricing. ASSUMPTIONS are marked; replace with measured data from the pilot.
const FX = 0.79;                                  // ASSUMPTION: USD -> GBP
const usd = n => n * FX;
const A = {
  // Neon (Launch): $0.106/CU-h, $0.35/GB-month storage, $0.20/GB-month history. Scale to zero after 5 idle minutes.
  cellActiveHoursPerDay: 1.5, cellCU: 0.25, cellGB: 0.5, cellHistoryGB: 0.5,           // ASSUMPTION: activity pattern of a small shop
  controlCUHours: 0.25 * 730, controlStorageGB: 2,                                      // the control plane DB is always on (it runs the scheduler)
  // Railway: $0.00000386/GB-s memory, $0.00000772/vCPU-s CPU. One engine process per merchant.
  engineMemGB: 0.4, engineVCPU: 0.05,                                                   // ASSUMPTION: idle-ish Node process, to be measured
  sharedRedisUSD: 10, vercelPerMerchantGBP: 1.5, emailsPerMonth: 1500, gbpPerEmail: 0.0004, // ASSUMPTIONS
  contingency: 0.15, supportHourGBP: 25, supportHours: { commerce: 0.5, plus: 1.0 },  // support figures from research/04
};
const SECONDS = 30 * 24 * 3600;
const merchantsOnPlatform = n => {
  const cell = usd(A.cellActiveHoursPerDay * 30 * A.cellCU * 0.106 + A.cellGB * 0.35 + A.cellHistoryGB * 0.20);
  const engine = usd(A.engineMemGB * 0.00000386 * SECONDS + A.engineVCPU * 0.00000772 * SECONDS);
  const shared = (usd(A.controlCUHours * 0.106 + A.controlStorageGB * 0.35) + usd(A.sharedRedisUSD)) / n;
  const email = A.emailsPerMonth * A.gbpPerEmail;
  const infra = (cell + engine + shared + A.vercelPerMerchantGBP + email) * (1 + A.contingency);
  return { cell, engine, shared, email, infra };
};
const plans = {
  commerce: { monthly: 49.99, fee: v => v * 0.005 },
  plus30: { monthly: 99, fee: v => v * (v >= 100000 ? 0.002 : 0.003) },
  plus40: { monthly: 99, fee: v => v * 0.004 },
  plus50: { monthly: 99, fee: v => v * 0.005 },
};
const f = n => (n < 0 ? '-£' : '£') + Math.abs(n).toFixed(2);
const out = [];
for (const n of [10, 50, 200]) {
  const c = merchantsOnPlatform(n);
  out.push(`\n### Infrastructure per merchant at ${n} merchants: ${f(c.infra)}/month (cell DB ${f(c.cell)}, engine ${f(c.engine)}, shared control plane + queue ${f(c.shared)}, Vercel ${f(A.vercelPerMerchantGBP)}, email ${f(c.email)}, +15% contingency)`);
}
const c = merchantsOnPlatform(50);
out.push('\n### Contribution per merchant per month at 50 merchants (Stripe handles pricing, so no Connect cost to us)\n');
out.push('| Monthly sales | Commerce 0.5% | Plus 0.3%/0.2% | Plus 0.4% | Plus 0.5% |\n|---:|---:|---:|---:|---:|');
for (const v of [2000, 10000, 25000, 50000, 100000, 250000]) {
  const row = ['commerce', 'plus30', 'plus40', 'plus50'].map(k => { const p = plans[k]; const support = (k === 'commerce' ? A.supportHours.commerce : A.supportHours.plus) * A.supportHourGBP; return f(p.monthly + p.fee(v) - c.infra - support); });
  out.push(`| ${f(v).replace('.00', '')} | ${row.join(' | ')} |`);
}
out.push('\n### What the merchant pays each month (subscription + our fee), and where Plus becomes the cheaper choice\n');
out.push('| Monthly sales | Commerce | Plus 0.3%/0.2% | Plus 0.4% | Plus 0.5% |\n|---:|---:|---:|---:|---:|');
for (const v of [2000, 10000, 25000, 50000, 100000, 250000]) out.push(`| ${f(v).replace('.00', '')} | ${['commerce', 'plus30', 'plus40', 'plus50'].map(k => f(plans[k].monthly + plans[k].fee(v))).join(' | ')} |`);
const be = (rc, rp) => ((99 - 49.99) / (rc - rp));
out.push(`\nBreak-even (Plus costs the merchant less than Commerce above this monthly volume): 0.3% → ${f(be(0.005, 0.003)).replace('.00', '')}; 0.4% → ${f(be(0.005, 0.004)).replace('.00', '')}; 0.5% → never (Plus is always dearer on fees alone).`);
console.log(out.join('\n'));
