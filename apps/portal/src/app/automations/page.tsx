import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { Header } from '@/components/ui';
import { AutomationList } from '@/components/AutomationList';
export const metadata = { title: 'Automations' };
const out = { sent: ['Sent', 'ok'], skipped_no_consent: ['Skipped: no consent', ''], failed_retrying: ['Retrying', 'warn'], failed: ['Failed', 'bad'] } as const;
export default async function Automations() {
  const { rules, runs, runsLimit } = await gateway().automations();
  const used = rules.reduce((s, r) => s + r.runsMonth, 0);
  return (<>
    <Header title="Automations" eyebrow={`${used} of ${runsLimit} runs used this month`} />
    <div className="grid">
      <section className="c-7"  aria-labelledby="ru"><h2 id="ru" className="sr">Rules</h2><AutomationList rules={rules} />
        <div className="w" style={{ marginTop: 10 }}><div className="meter" role="progressbar" aria-label="Automation runs used" aria-valuenow={used} aria-valuemin={0} aria-valuemax={runsLimit}><i style={{ width: `${Math.min(100, (used / runsLimit) * 100)}%` }} /></div><p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>Your plan includes {runsLimit} automation runs a month.</p></div></section>
      <section className="w c-5" aria-labelledby="hi"><div className="wh"><h2 id="hi">Recent runs</h2></div>
        <div className="rows">{runs.map(r => (<div key={r.id} className="row" style={{ alignItems: 'flex-start' }}><span className="t" style={{ whiteSpace: 'normal' }}><b style={{ whiteSpace: 'normal' }}>{r.automation}</b><span>{r.event} · {when(r.at)}</span><span style={{ display: 'block' }}>{r.detail}</span></span><span className={`badge ${out[r.outcome][1]}`}>{out[r.outcome][0]}</span></div>))}</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Every run is logged. Failed sends retry automatically with a growing delay, and the same event never sends twice.</p></section>
    </div></>);
}
