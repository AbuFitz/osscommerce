import { gateway } from '@/lib/gateway-instance';
import { money, day } from '@/lib/format';
import { Header } from '@/components/ui';
import { NewRequest, QuoteDecision } from '@/components/RequestActions';
export const metadata = { title: 'Support' };
const st = { submitted: ['Sent', ''], quoted: ['Quote ready', 'warn'], in_progress: ['In progress', 'info'], done: ['Done', 'ok'], declined: ['Declined', ''] } as const;
const kind = { product_upload: 'Product upload', design_change: 'Design change', content: 'Content', integration: 'Integration', other: 'Other' } as const;
export default async function Support() {
  const rs = await gateway().serviceRequests();
  return (<>
    <Header title="Support" eyebrow="Requests go to the OneSimpleCommerce team"><NewRequest /></Header>
    <div className="grid">
      <section className="w c-8" aria-labelledby="rq"><div className="wh"><h2 id="rq">Your requests</h2></div>
        {rs.length === 0 ? <div className="empty">No requests yet. Ask us for product uploads, design changes, content or integrations.</div> :
          <div className="rows">{rs.map(r => (<div key={r.id} className="row" style={{ alignItems: 'flex-start' }}><span className="t" style={{ whiteSpace: 'normal' }}><b style={{ whiteSpace: 'normal' }}>{r.title}</b><span>{kind[r.kind]} · {day(r.createdAt)}{r.quoteMinor ? ` · ${money(r.quoteMinor)} + VAT` : ''}</span></span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{r.status === 'quoted' ? <QuoteDecision r={r} /> : <span className={`badge ${st[r.status][1]}`}>{st[r.status][0]}</span>}</span></div>))}</div>}</section>
      <aside className="c-4" style={{ display: 'grid', gap: 16, alignContent: 'start', }}>
        <section className="w tint-lime"><h2 style={{ marginBottom: 8 }}>What is included</h2><p style={{ margin: 0 }}>Technical support for the platform, hosting and payments is part of your subscription. Support hours and response times are in your order form.</p></section>
        <section className="w"><h2 style={{ marginBottom: 8 }}>What is quoted</h2><p className="muted" style={{ margin: 0 }}>Product uploads, design changes, content creation and extra integrations are separate services. You see a fixed quote and approve it before we start.</p></section>
      </aside>
    </div></>);
}
