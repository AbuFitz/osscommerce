import { Search } from 'lucide-react';
import { CommandPalette } from '@/components/CommandPalette';
import { OpenPalette, PaletteIcon } from '@/components/OpenPalette';
import Link from 'next/link';
import { Shell, TabBar } from '@/components/Nav';
import { cookies } from 'next/headers';
import { PROGRESSIVE } from '@/components/nav-data';
import { Switcher } from '@/components/Switcher';
import { NotificationBell, StatusBanner, type BannerData } from '@/components/Notices';
import { gateway } from '@/lib/gateway-instance';
import { LIVE } from '@/lib/session';
import { hiddenFor } from '@/lib/access';

export const dynamic = 'force-dynamic';


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const g = gateway();
  const [s, notices, all, pay, me] = await Promise.all([g.store(), g.notices(), g.orders(), g.paymentSetup(), g.viewer()]);
  const date = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
  const copy: Record<string, Pick<BannerData, 'tone' | 'body' | 'action'>> = {
    restricted: { tone: 'danger', body: 'Customers cannot pay right now.', action: 'Get help' },
    disconnected: { tone: 'danger', body: 'Checkout is paused until you reconnect.', action: 'Reconnect' },
    payouts_paused: { tone: 'danger', body: 'Check your bank details. Customers can still pay.', action: 'Fix payouts' },
    action_required: { tone: 'warn', body: pay.due[0] ? `${pay.due[0]} is needed${pay.deadline ? ' by ' + date(pay.deadline) : ''}.` : pay.detail, action: 'Review' },
  };
  const banner: BannerData | null = copy[pay.status] ? { ...copy[pay.status], title: pay.headline + '.', href: '/settings/payments', id: pay.status } : null;
  // Progressive navigation: sections with nothing to show yet stay out of the way until the first order.
  const hidden = [...(all.length === 0 ? PROGRESSIVE : []), ...hiddenFor(me.kind)];
  const expanded = (await cookies()).get('oss_rail')?.value === 'open';
  return (<>
        <Shell initials={me.initials} name={me.name} role={me.role} live={LIVE} hidden={hidden} defaultExpanded={expanded}>
          <div className="stage">
            <StatusBanner banner={banner} />
            <header className="top">
              <Switcher name={s.name} /><div className="spacer" />
              <OpenPalette />
              <NotificationBell notices={notices} />
            </header>
            <header className="topbar"><Switcher name={s.name} /><div className="spacer" /><PaletteIcon /><NotificationBell notices={notices} /></header>
            <main id="main">{children}</main>
          </div>
        </Shell>
        <TabBar /><CommandPalette /></>
  );
}
