'use client';
import { useState } from 'react';
import { Toggle, Dialog } from '@oss-commerce/ui';
import { useRun } from './Actions';
import { setAutomation } from '@/app/actions';
import type { Automation } from '@/lib/gateway';

const KIND = { transactional: ['Essential', 'info'], operational: ['For you', ''], marketing: ['Marketing', 'warn'] } as const;
export function AutomationList({ rules }: { rules: Automation[] }) {
  const [state, setState] = useState(() => Object.fromEntries(rules.map(r => [r.id, r.enabled])));
  const [consent, setConsent] = useState<Automation | null>(null); const { run, pending } = useRun();
  const flip = (r: Automation, on: boolean) => { if (r.kind === 'marketing' && on) return setConsent(r); setState(s => ({ ...s, [r.id]: on })); run(() => setAutomation(r.id, on), undefined); };
  return (
    <>
      <div className="rows" style={{ gap: 10 }}>
        {rules.map(r => (
          <div key={r.id} className="w" style={{ padding: '4px 20px' }}>
            <Toggle label={r.name} checked={!!state[r.id]} disabled={pending || r.kind === 'transactional'} onChange={v => flip(r, v)}
              description={`${r.trigger} → ${r.action}${r.kind === 'transactional' ? '. Required, so it cannot be turned off.' : ''}${r.needsConsent ? '. Only sends to customers who agreed to marketing.' : ''}`} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 14 }}><span className={`badge ${KIND[r.kind][1]}`}>{KIND[r.kind][0]}</span><span className="muted" style={{ fontSize: 12.5 }}>{r.runsMonth} runs this month{r.lastRun ? '' : ''}</span></div>
          </div>))}
      </div>
      <Dialog open={!!consent} onClose={() => setConsent(null)} title="Turn on a marketing automation?" description="Marketing emails need the customer's agreement. We only send to customers who ticked the marketing box, and every email carries an unsubscribe link."
        footer={<><button className="btn" type="button" onClick={() => setConsent(null)}>Not now</button><button className="btn primary" type="button" disabled={pending} onClick={() => { const r = consent!; setState(s => ({ ...s, [r.id]: true })); run(() => setAutomation(r.id, true), () => setConsent(null)); }}>Turn on</button></>}>
        <p className="note">You are responsible for having a lawful basis to contact your customers. Check your privacy policy covers this.</p>
      </Dialog>
    </>
  );
}
