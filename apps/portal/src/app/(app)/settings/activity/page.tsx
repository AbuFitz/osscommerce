import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { ActivityFeed } from '@/components/team/ActivityFeed';
export const metadata = { title: 'Activity' };
export default async function Activity({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const g = gateway(); const me = await g.viewer(); const { who } = await searchParams;
  if (me.kind === 'fulfilment' || me.kind === 'analyst') return (<><Header title="Activity" back={{ href: '/settings', label: 'Settings' }} /><p className="muted">Only owners and managers can see the activity log.</p></>);
  const [page, { members }] = await Promise.all([g.activity({ actor: who }), me.kind === 'owner' ? g.team() : Promise.resolve({ members: [] })]);
  return (<><Header title="Activity" back={{ href: '/settings', label: 'Settings' }} />
    <section className="w" aria-labelledby="al"><div className="wh"><h2 id="al">What your team has done</h2>
      {members.length > 1 && <form className="actf" action="/settings/activity"><label className="sr" htmlFor="who">Show activity by</label><div className="field"><select id="who" name="who" defaultValue={who ?? ''}><option value="">Everyone</option>{members.map(m => <option key={m.email} value={m.name}>{m.name}</option>)}</select></div><button className="btn sm" type="submit">Show</button></form>}</div>
      <ActivityFeed key={who ?? 'all'} first={page.items} hasMore={page.hasMore} actor={who} /></section></>);
}
