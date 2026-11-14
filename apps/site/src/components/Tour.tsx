'use client';
import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { BrowserFrame, PhoneFrame } from './Frames';

const TABS = [
  { id: 'orders', label: 'Orders', title: 'See what needs doing first.', body: 'Payment and fulfilment are tracked separately, so a paid order that has not shipped never looks the same as one that has.', pts: ['Filter to what needs you in one tap', 'Clear statuses in plain words', 'Refund and fulfil without leaving the order'], desk: 'orders-desk', mob: 'orders-mob' },
  { id: 'insights', label: 'Insights', title: 'Sales you can trust.', body: 'Net sales are after refunds and before payment fees, and the screen says so. No invented trend arrows, and charts only appear when there is enough data to say something.', pts: ['Gross and net shown side by side', 'Every chart has a table alternative', 'Reconciles to your Stripe payouts'], desk: 'analytics-desk', mob: 'overview-mob' },
  { id: 'storefront', label: 'Storefront', title: 'Know your shop is healthy.', body: 'Your theme version, domain, SSL and checkout checks in one place, with one-click rollback if a change does not work out.', pts: ['Domain stays yours', 'Roll back to any earlier version', 'Launch only when every check passes'], desk: 'storefront-desk', mob: 'overview-mob' },
  { id: 'control', label: 'Control', title: 'Switches that behave.', body: 'Change a setting and a save bar appears. Leave without saving and you are warned. Risky switches, like pausing checkout, ask once and explain the effect.', pts: ['Unsaved changes are never lost silently', 'Plain-language consequences', 'Works the same on a phone'], desk: 'prefs-desk', mob: 'order-mob' },
] as const;

export function Tour() {
  const [i, setI] = useState(0);
  const id = useId();
  const t = TABS[i];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setI((i + 1) % TABS.length);
    if (e.key === 'ArrowLeft') setI((i + TABS.length - 1) % TABS.length);
  };
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Platform tour" onKeyDown={onKey}>
        {TABS.map((x, n) => <button key={x.id} id={`${id}-${x.id}`} role="tab" type="button" aria-selected={n === i} aria-controls={`${id}-panel`} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}>{x.label}</button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${t.id}`} className="split" style={{ marginTop: 40 }}>
        <div className="tour-copy">
          <h3>{t.title}</h3><p>{t.body}</p>
          <ul className="ticks">{t.pts.map(p => <li key={p}><Check size={18} aria-hidden /><span>{p}</span></li>)}</ul>
        </div>
        <div>
          <div className="only-d"><BrowserFrame src={`/showcase/${t.desk}.jpg`} alt={`${t.label} screen of the merchant dashboard`} /></div>
          <div className="only-m"><PhoneFrame src={`/showcase/${t.mob}.jpg`} alt={`${t.label} on a phone`} /></div>
        </div>
      </div>
    </div>
  );
}
