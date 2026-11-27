import Link from 'next/link';
import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import type { VisitorStats } from '@/lib/gateway';
export const metadata = { title: 'Visitors' };
const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']] as const;
const pct = (n: number, of: number) => (of > 0 ? `${((n / of) * 100).toFixed(1)}%` : '–');
const num = (n: number) => n.toLocaleString('en-GB');

function Bars({ rows, total, label }: { rows: { label: string; count: number }[]; total: number; label: string }) {
  if (rows.length === 0) return <p className="muted" style={{ margin: 0 }}>Nothing yet.</p>;
  return (<ul className="vs-bars" aria-label={label}>{rows.map(r => <li key={r.label}><span className="vs-l">{r.label}</span><span className="vs-bar" aria-hidden><i style={{ width: `${Math.max(3, total ? (r.count / total) * 100 : 0)}%` }} /></span><span className="num">{num(r.count)}</span></li>)}</ul>);
}
function Funnel({ f }: { f: VisitorStats['funnel'] }) {
  const steps = [['Visited the shop', f.visited], ['Looked at a product', f.viewedProduct], ['Added to basket', f.addedToCart], ['Started checkout', f.startedCheckout], ['Bought', f.purchased]] as const;
  return (<ol className="vs-funnel" aria-label="Where visitors drop off">{steps.map(([l, n], i) => <li key={l}><div className="vs-fl"><b>{l}</b><span className="num">{num(n)}</span></div><span className="vs-bar big" aria-hidden><i style={{ width: `${f.visited ? Math.max(2, (n / f.visited) * 100) : 0}%` }} /></span><span className="muted vs-fp">{i === 0 ? 'Everyone who came' : `${pct(n, steps[i - 1][1])} of the step before · ${pct(n, f.visited)} of all`}</span></li>)}</ol>);
}
function Daily({ d }: { d: VisitorStats['daily'] }) {
  const max = Math.max(1, ...d.map(x => x.visitors));
  return (<div className="vs-daily" role="img" aria-label={`Visitors each day, from ${d[0]?.day ?? ''} to ${d.at(-1)?.day ?? ''}`}>{d.map(x => <span key={x.day} title={`${x.day}: ${x.visitors} visitors`} style={{ height: `${Math.max(4, (x.visitors / max) * 100)}%` }} />)}</div>);
}

export default async function Visitors({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await gate('/analytics'); const q = await searchParams; const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const s = await gateway().visitorStats(days);
  return (<><Header title="Visitors" eyebrow={`Last ${days} days`} back={{ href: '/analytics', label: 'Analytics' }} />
    <div className="toolbar"><nav className="seg" aria-label="Period">{RANGES.map(([n, l]) => <Link key={n} href={`/analytics/visitors?days=${n}`} aria-current={days === n}>{l}</Link>)}</nav></div>
    {s.visitors === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>No visits recorded yet</b><p style={{ margin: '6px 0 0' }}>Once your storefront sends visits, they appear here. Visitors are counted without cookies and nothing about a person is kept.</p></div> : <>
      <div className="kgrid" style={{ marginBottom: 16 }}>{[['Visitors', num(s.visitors)], ['Page views', num(s.pageviews)], ['Pages per visit', s.visitors ? (s.pageviews / s.visitors).toFixed(1) : '–'], ['Conversion', pct(s.funnel.purchased, s.visitors)]].map(([l, v], i) => <div key={l} className={`w kcard ${i === 0 ? 'dark' : ''}`}><div className="muted">{l}</div><div className="kpi">{v}</div></div>)}</div>
      <div className="grid">
        <section className="w c-7" aria-labelledby="vf"><h2 id="vf" style={{ marginBottom: 12 }}>From visit to sale</h2><Funnel f={s.funnel} /></section>
        <section className="w c-5" aria-labelledby="vd"><h2 id="vd" style={{ marginBottom: 12 }}>Visitors each day</h2><Daily d={s.daily} /></section>
        <section className="w c-4" aria-labelledby="vs"><h2 id="vs" style={{ marginBottom: 12 }}>Where they came from</h2><Bars rows={s.sources} total={s.visitors} label="Sources" /></section>
        <section className="w c-4" aria-labelledby="vp"><h2 id="vp" style={{ marginBottom: 12 }}>Top pages</h2><Bars rows={s.pages} total={Math.max(1, ...s.pages.map(p => p.count))} label="Pages" /></section>
        <section className="w c-4" aria-labelledby="vv"><h2 id="vv" style={{ marginBottom: 12 }}>Devices</h2><Bars rows={s.devices} total={s.visitors} label="Devices" /></section>
      </div></>}
    <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Counted without cookies. A visitor is recognised for one day by a hash that cannot be linked from one day to the next; addresses and browsers are never stored, and the hashes are deleted after two days.</p></>);
}
