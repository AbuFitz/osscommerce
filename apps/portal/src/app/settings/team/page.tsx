import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { Header, Avatar } from '@/components/ui';
import { InviteAction, GrantAction } from '@/components/Actions';
export const metadata = { title: 'Team and access' };
const role = { owner: 'Owner', manager: 'Manager', fulfilment: 'Fulfilment', analyst: 'Analyst' } as const;
export default async function Team() {
  const { members, grants } = await gateway().team();
  return (<><Header title="Team and access" eyebrow="Settings"><InviteAction /></Header>
    <div className="grid">
      <section className="w c-7" aria-labelledby="mb"><div className="wh"><h2 id="mb">Members</h2></div>
        <div className="rows">{members.map((m, i) => <div key={m.email} className="row"><Avatar name={m.name} i={i} /><span className="t"><b>{m.name}</b><span>{m.email}</span></span><span className={`badge ${m.status === 'active' ? 'ok' : 'warn'}`}>{m.status === 'active' ? role[m.role] : `Invited · ${role[m.role]}`}</span></div>)}</div></section>
      <section className="w c-5" aria-labelledby="gr"><div className="wh"><h2 id="gr">Access requests</h2></div>
        <div className="rows">{grants.map(g => (
          <div key={g.id} className="w" style={{ padding: 14, boxShadow: 'none', background: 'rgba(30,40,15,.045)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{g.who}</b><span className={`badge ${g.state === 'active' ? 'ok' : 'warn'}`}>{g.state === 'pending' ? 'Needs your approval' : 'Active'}</span></div>
            <div className="muted" style={{ margin: '4px 0 8px' }}>{g.purpose}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{g.scopes.join(', ')} · {g.write ? 'can make changes' : 'read only'} · until {when(g.expires)}</div>
            <GrantAction who={g.who} state={g.state === 'pending' ? 'pending' : 'active'} />
          </div>))}</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>OSS only sees your store with your approval. Everything is logged and you can revoke at any time.</p></section>
    </div></>);
}
