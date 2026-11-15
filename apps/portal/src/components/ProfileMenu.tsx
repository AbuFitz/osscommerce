'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Globe, FileText, SlidersHorizontal, ChevronsUpDown } from 'lucide-react';
import { Popover } from './Popover';

/** The account corner of the menu. Commerce is self-contained: plan, team, preferences and help all live here. */
export function ProfileMenu({ initials, name, role, open }: { initials: string; name: string; role: string; open: boolean }) {
  const btn = useRef<HTMLButtonElement>(null); const [show, setShow] = useState(false);
  const items = [{ href: '/account/billing', label: 'Plan and billing', note: 'Your subscription and invoices', icon: FileText }, { href: '/settings/team', label: 'Team and access', note: 'Members and roles', icon: LayoutGrid }, { href: '/settings/preferences', label: 'Preferences', note: 'Alerts and checkout', icon: SlidersHorizontal }, { href: '/support', label: 'Help and requests', note: 'Talk to the OneSimpleCommerce team', icon: Globe }];
  return (<>
    <button ref={btn} type="button" className="rail-me" aria-haspopup="dialog" aria-expanded={show} aria-label={`Account menu, ${name}`} onClick={() => setShow(s => !s)}>
      <span className="avatar" aria-hidden>{initials}</span><span className="who"><b>{name}</b><span>{role}</span></span><ChevronsUpDown size={15} className="rm-chev" aria-hidden />
    </button>
    <Popover open={show} onClose={() => setShow(false)} anchor={btn} placement={open ? 'top-start' : 'right-end'} label="Account menu" width={290}>
      <div className="pmenu"><div className="pm-head"><span className="avatar" aria-hidden>{initials}</span><span><b>{name}</b><small>{role}</small></span></div>
        <ul>{items.map(i => <li key={i.href}><Link href={i.href} onClick={() => setShow(false)}><i.icon size={18} aria-hidden /><span><b>{i.label}</b><small>{i.note}</small></span></Link></li>)}</ul></div>
    </Popover></>);
}
