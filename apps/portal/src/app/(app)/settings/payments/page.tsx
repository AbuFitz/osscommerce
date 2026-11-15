import { Check } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { DEMO } from '@/lib/env';
import { Header } from '@/components/ui';
import { Brand, MethodRow } from '@/components/Brand';
import { PaymentSetupActions } from '@/components/PaymentSetupActions';
import type { PaymentSetupStatus } from '@/lib/gateway';
export const metadata = { title: 'Payments' };

const TONE: Record<PaymentSetupStatus, { cls: string; label: string }> = {
  unknown: { cls: 'info', label: 'Checking' }, not_started: { cls: 'info', label: 'Not set up' }, onboarding: { cls: 'warn', label: 'Setup in progress' }, pending_verification: { cls: 'info', label: 'Verifying' },
  action_required: { cls: 'warn', label: 'Action needed' }, restricted: { cls: 'err', label: 'Restricted' }, enabled: { cls: 'ok', label: 'Enabled' }, payouts_paused: { cls: 'warn', label: 'Payouts paused' }, disconnected: { cls: 'err', label: 'Disconnected' },
};
const CTA: Partial<Record<PaymentSetupStatus, string>> = { not_started: 'Set up payments', onboarding: 'Continue setup', action_required: 'Provide details', payouts_paused: 'Check bank details', disconnected: 'Reconnect Stripe', pending_verification: 'Review in Stripe' };
const STEPS = ['Your details', 'Verification', 'Bank account', 'Payments on'];
/** Number of completed steps. Onboarding means Stripe still needs details, so nothing is ticked yet. */
function stepIndex(s: PaymentSetupStatus, payouts: boolean, charges: boolean) { if (s === 'not_started' || s === 'unknown' || s === 'onboarding') return 0; if (s === 'pending_verification') return 1; if (s === 'restricted' || s === 'disconnected') return charges ? 2 : 1; if (charges && payouts) return 4; if (charges) return 2; return 1; }
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined);

export default async function Payments({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams; const g = gateway();
  const [p, store] = await Promise.all([g.paymentSetup(DEMO ? state : undefined), g.store()]); const domainOk = store.store.hostnames[0]?.verified ?? false;
  const tone = TONE[p.status], step = stepIndex(p.status, p.payoutsEnabled, p.chargesEnabled), cta = CTA[p.status], deadline = when(p.deadline);
  return (<><Header title="Payments" back={{ href: '/settings', label: 'Settings' }}>{p.account && <a className="btn only-d" href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe dashboard</a>}</Header>
    <div className="grid">
      <section className="w dark c-7" aria-labelledby="st"><div className="wh"><h2 id="st">{p.headline}</h2><span className={`badge ${tone.cls}`}>{tone.label}</span></div>
        <p style={{ margin: '0 0 4px', maxWidth: 520 }}>{p.detail}</p>
        {deadline && <p className="muted" style={{ margin: '4px 0 0' }}>Deadline: <strong>{deadline}</strong></p>}
        <ol className="steps four" aria-label="Setup progress" style={{ listStyle: 'none', padding: 0 }}>{STEPS.map((x, i) => <li key={x}><div className={i < step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>{i < step && <Check size={12} aria-hidden style={{ marginRight: 4 }} />}{x}</div></li>)}</ol>
        {cta && <div style={{ marginTop: 22 }}><PaymentSetupActions label={cta} /></div>}
        {p.status === 'restricted' && <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>We cannot fix this from here. <a href="/support">Contact support</a> and we will pick it up with Stripe.</p>}
      </section>
      <section className="w c-5" aria-labelledby="req"><div className="wh"><h2 id="req">What Stripe needs</h2></div>
        {p.due.length ? <ul className="check">{p.due.map(d => <li key={d}><span className="tick" /><div style={{ fontWeight: 550 }}>{d}</div></li>)}</ul> : <p className="muted" style={{ margin: 0 }}>{p.pending.length ? `Stripe is reviewing: ${p.pending.join(', ')}.` : 'Nothing is needed from you right now.'}</p>}
        <p className="muted" style={{ marginBottom: 0, fontSize: 12.5, marginTop: 16 }}>You enter business, identity and bank details in Stripe, not in OSS. We never see or store them.</p></section>
      <section className="w c-12" aria-labelledby="pmx"><div className="wh"><h2 id="pmx">What customers can pay with</h2><span className="pm"><Brand name="stripe" size={28} title /><span className="muted">via Stripe</span></span></div>
        <MethodRow items={[{ key: 'visa', label: 'Visa', on: p.chargesEnabled }, { key: 'mastercard', label: 'Mastercard', on: p.chargesEnabled }, { key: 'amex', label: 'Amex', on: p.chargesEnabled },
          { key: 'applepay', label: 'Apple Pay', on: p.chargesEnabled && domainOk, note: p.chargesEnabled && !domainOk ? 'Needs domain' : undefined }, { key: 'googlepay', label: 'Google Pay', on: p.chargesEnabled && domainOk, note: p.chargesEnabled && !domainOk ? 'Needs domain' : undefined },
          { key: 'link', label: 'Link', on: p.chargesEnabled && domainOk, note: p.chargesEnabled && !domainOk ? 'Needs domain' : undefined },
          { key: 'paypal', label: 'PayPal', on: false, note: 'Not yet' }, { key: 'klarna', label: 'Klarna', on: false, note: 'Not yet' }, { key: 'clearpay', label: 'Clearpay', on: false, note: 'Not yet' }]} />
        <p className="muted" style={{ margin: '14px 0 0', fontSize: 12.5 }}>Wallets need your domain verified so Apple and Google can confirm it is yours. Buy-now-pay-later and PayPal are added only after they are proven for UK accounts.</p></section>
      <section className="w c-6" aria-labelledby="av"><div className="wh"><h2 id="av">Availability</h2></div>
        <ul className="check">{[{ l: 'Customers can pay', ok: p.chargesEnabled }, { l: 'Payouts to your bank', ok: p.payoutsEnabled }, { l: 'Checkout on your website', ok: p.checkoutAllowed }].map(c => <li key={c.l}><span className={`tick ${c.ok ? 'on' : ''}`}>{c.ok && <Check size={12} aria-hidden />}</span><div style={{ fontWeight: 550 }}>{c.l}<span className="sr">{c.ok ? ' — available' : ' — not available'}</span></div></li>)}</ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12.5 }}>When checkout is off, existing orders, refunds and your reports stay available.</p></section>
      <section className="w c-6" aria-labelledby="ac"><div className="wh"><h2 id="ac">Account</h2></div>
        <dl className="kv"><dt>Stripe account</dt><dd className="mono">{p.account ?? 'Not connected'}</dd><dt>Payouts</dt><dd>{p.payoutSchedule ?? 'Not set'}</dd><dt>OSS application fee</dt><dd className="num">{(p.applicationFeeBp / 100).toFixed(2)}% of each captured payment</dd></dl>
        <p className="muted" style={{ marginBottom: 0, fontSize: 12.5, marginTop: 14 }}>Customers pay your Stripe account directly. OSS never holds your funds.</p>{p.account && <a className="btn only-m" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe dashboard</a>}</section>
    </div></>);
}
