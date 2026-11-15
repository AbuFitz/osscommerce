import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { Shell, TabBar } from '@/components/Nav';
import { cookies } from 'next/headers';
import { PROGRESSIVE } from '@/components/nav-data';
import { Switcher } from '@/components/Switcher';
import { gateway } from '@/lib/gateway-instance';

export const dynamic = 'force-dynamic';

const Bellink = ({ n }: { n: number }) => <Link className="iconbtn" href="/orders?filter=attention" aria-label={n ? `${n} needs attention` : 'Notifications'}><Bell size={18} aria-hidden />{n > 0 && <span className="dot" />}</Link>;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const g = gateway();
  const [s, attention, all] = await Promise.all([g.store(), g.orders({ filter: 'attention' }), g.orders()]);
  // Progressive navigation: sections with nothing to show yet stay out of the way until the first order.
  const hidden = all.length === 0 ? PROGRESSIVE : [];
  const expanded = (await cookies()).get('oss_rail')?.value === 'open';
  return (<>
        <Shell initials="MO" name="Maya Okafor" role="Owner" hidden={hidden} defaultExpanded={expanded}>
          <div className="stage">
            <header className="top">
              <Switcher name={s.name} /><div className="spacer" />
              <form className="searchpill" role="search" action="/orders"><Search size={16} aria-hidden /><label className="sr" htmlFor="gq">Search orders</label><input id="gq" name="q" placeholder="Search orders and customers" /></form>
              <Bellink n={attention.length} />
            </header>
            <header className="topbar"><Switcher name={s.name} /><div className="spacer" /><Bellink n={attention.length} /></header>
            <main id="main">{children}</main>
          </div>
        </Shell>
        <TabBar /></>
  );
}
