import { Search } from 'lucide-react';
import Link from 'next/link';
import { Shell, TabBar } from '@/components/Nav';
import { cookies } from 'next/headers';
import { PROGRESSIVE } from '@/components/nav-data';
import { Switcher } from '@/components/Switcher';
import { NotificationBell, StatusBanner, type BannerData } from '@/components/Notices';
import { gateway } from '@/lib/gateway-instance';

export const dynamic = 'force-dynamic';


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const g = gateway();
  const [s, notices, all, pay] = await Promise.all([g.store(), g.notices(), g.orders(), g.paymentSetup()]);
  const date = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
  const copy: Record<string, Pick<BannerData, 'tone' | 'body' | 'action'>> = {
    restricted: { tone: 'danger', body: 'Customers cannot pay right now.', action: 'Get help' },
    disconnected: { tone: 'danger', body: 'Checkout is paused until you reconnect.', action: 'Reconnect' },
    payouts_paused: { tone: 'danger', body: 'Check your bank details. Customers can still pay.', action: 'Fix payouts' },
    action_required: { tone: 'warn', body: pay.due[0] ? `${pay.due[0]} is needed${pay.deadline ? ' by ' + date(pay.deadline) : ''}.` : pay.detail, action: 'Review' },
  };
  const banner: BannerData | null = copy[pay.status] ? { ...copy[pay.status], title: pay.headline + '.', href: '/settings/payments', id: pay.status } : null;
  // Progressive navigation: sections with nothing to show yet stay out of the way until the first order.
  const hidden = all.length === 0 ? PROGRESSIVE : [];
  const expanded = (await cookies()).get('oss_rail')?.value === 'open';
  return (<>
        <Shell initials="MO" name="Maya Okafor" role="Owner" hidden={hidden} defaultExpanded={expanded}>
          <div className="stage">
            <StatusBanner banner={banner} />
            <header className="top">
              <Switcher name={s.name} /><div className="spacer" />
              <form className="searchpill" role="search" action="/orders"><Search size={16} aria-hidden /><label className="sr" htmlFor="gq">Search orders</label><input id="gq" name="q" placeholder="Search orders and customers" /></form>
              <NotificationBell notices={notices} />
            </header>
            <header className="topbar"><Switcher name={s.name} /><div className="spacer" /><NotificationBell notices={notices} /></header>
            <main id="main">{children}</main>
          </div>
        </Shell>
        <TabBar /></>
  );
}
