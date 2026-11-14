import { Check, ExternalLink, History, X } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { Header } from '@/components/ui';
import { RollbackAction } from '@/components/Actions';
export const metadata = { title: 'Storefront' };
const st = { healthy: ['Healthy', 'ok'], building: ['Building', 'info'], failed: ['Deploy failed', 'bad'] } as const;

export default async function Storefront() {
  const [sf, store] = await Promise.all([gateway().storefront(), gateway().store()]);
  const h = store.store.hostnames[0];
  return (<>
    <Header title="Storefront" eyebrow={`Theme ${sf.theme.name} · v${sf.theme.version}`}>
      <a className="btn" href={sf.previewUrl} target="_blank" rel="noreferrer">Open preview <ExternalLink size={15} aria-hidden /></a><button className="btn primary" type="button">Request launch</button></Header>
    <div className="grid">
      <section className="hero solo c-8"  aria-labelledby="th">
        <div><span className="glass">{sf.liveUrl ? 'Live' : 'Not live yet'}</span><h2 id="th">{sf.theme.name} theme</h2><p>Deployed {when(sf.theme.deployedAt)} · <span className={`badge ${st[sf.theme.state][1]}`} style={{ marginLeft: 4 }}>{st[sf.theme.state][0]}</span></p>
          <div className="acts" style={{ marginTop: 22 }}><a className="btn" href={sf.previewUrl} style={{ color: 'var(--ink)' }}>Preview store</a><button className="btn ghost" type="button">Request design change</button></div></div>
        <div className="stat"><b>v{sf.theme.version}</b><span>{sf.liveUrl ? 'Live theme version' : 'Preview theme version'}</span></div>
      </section>
      <section className="w dark c-4" aria-labelledby="dm"><div className="wh"><h2 id="dm">Domain</h2><span className={`badge ${h.verified ? 'ok' : 'warn'}`}>{h.verified ? 'Verified' : 'Not verified'}</span></div>
        <div className="mono" style={{ fontSize: 14 }}>{h.host}</div><p className="muted">{h.verified ? 'SSL active.' : 'Add the DNS record we show you, then check again. Your domain stays yours.'}</p><button className="btn lime sm" type="button">Check domain</button></section>
      <section className="w c-7" aria-labelledby="hc"><div className="wh"><h2 id="hc">Health checks</h2></div>
        <ul className="check">{sf.checks.map(c => <li key={c.label}><span className={`tick ${c.ok ? 'on' : ''}`} style={c.ok ? undefined : { borderColor: '#c2410c', color: '#c2410c' }}>{c.ok ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />}</span><div><span style={{ fontWeight: 550 }}>{c.label}</span><span className="sr">{c.ok ? ' — passing' : ' — failing'}</span><small>{c.detail}</small></div></li>)}</ul></section>
      <section className="w c-5" aria-labelledby="vh"><div className="wh"><h2 id="vh">Versions</h2><History size={16} className="muted" aria-hidden /></div>
        <div className="rows">{sf.history.map(v => <div key={v.version} className="row"><span className="t"><b>v{v.version}</b><span>{v.note} · {when(v.at)}</span></span>{v.current ? <span className="badge ok">Current</span> : <RollbackAction version={v.version} />}</div>)}</div></section>
    </div></>);
}
