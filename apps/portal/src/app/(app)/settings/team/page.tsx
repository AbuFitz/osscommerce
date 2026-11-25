import { gateway } from '@/lib/gateway-instance';
import { when } from '@/lib/format';
import { Header, Avatar } from '@/components/ui';
import { GrantAction } from '@/components/Actions';
import { InviteStaff, MemberActions, ChangePassword } from '@/components/team/TeamActions';
import { ROLE_INFO } from '@/lib/gateway';
export const metadata = { title: 'Team and access' };
export default async function Team() {
  const g = gateway(); const me = await g.viewer(); const owner = me.kind === 'owner'; const { members, grants } = await g.team();
  return (<><Header title="Team and access" back={{ href: '/settings', label: 'Settings' }}>{owner ? <InviteStaff /> : <ChangePassword />}</Header>
    <div className="grid">
      <section className="w c-7" aria-labelledby="mb"><div className="wh"><h2 id="mb">Members</h2></div>
        <div className="rows">{members.map((m, i) => <div key={m.id ?? m.email} className="row mrow"><Avatar name={m.name} i={i} /><span className="t"><b>{m.name}{m.self ? ' (you)' : ''}</b><span>{m.email}</span></span><span className="badge" title={ROLE_INFO[m.role].blurb}>{ROLE_INFO[m.role].label}</span>{owner && m.id && m.role !== 'owner' && <MemberActions id={m.id} name={m.name} role={m.role} />}</div>)}</div>
        {owner && <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Owners do everything. Managers cannot change delivery, payments or staff. <a href="/settings/activity">See the activity log</a>.</p>}{owner && <div style={{ marginTop: 12 }}><ChangePassword /></div>}</section>
      <section className="w c-5" aria-labelledby="gr"><div className="wh"><h2 id="gr">Access requests</h2></div>
        <div className="rows">{grants.map(g => (
          <div key={g.id} className="w" style={{ padding: 14, boxShadow: 'none', background: 'rgba(26,26,29,.045)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{g.who}</b><span className={`badge ${g.state === 'active' ? 'ok' : 'warn'}`}>{g.state === 'pending' ? 'Needs your approval' : 'Active'}</span></div>
            <div className="muted" style={{ margin: '4px 0 8px' }}>{g.purpose}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{g.scopes.join(', ')} · {g.write ? 'can make changes' : 'read only'} · until {when(g.expires)}</div>
            <GrantAction id={g.id} state={g.state === 'pending' ? 'pending' : 'active'} />
          </div>))}</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>OSS only sees your store with your approval. Everything is logged and you can revoke at any time.</p></section>
    </div></>);
}
