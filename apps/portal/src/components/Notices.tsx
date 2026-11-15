'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CircleAlert, TriangleAlert, Info, CircleCheck, CheckCheck, X } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { Popover } from './Popover';
import { markNoticesRead } from '@/app/actions';
import type { Notice } from '@/lib/gateway';

const ICON = { danger: CircleAlert, warn: TriangleAlert, info: Info, success: CircleCheck } as const;
const ago = (iso: string) => { const m = Math.round((Date.parse('2026-11-15T09:00:00Z') - Date.parse(iso)) / 60000); if (m < 60) return `${Math.max(m, 1)} min ago`; if (m < 1440) return `${Math.round(m / 60)} h ago`; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const useNarrow = () => { const [n, setN] = useState(false); useEffect(() => { const m = matchMedia('(max-width:900px)'); const f = () => setN(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []); return n; };

function NoticeIcon({ tone }: { tone: Notice['tone'] }) { const I = ICON[tone]; return <span className={`nic ${tone}`} aria-hidden><I size={18} /></span>; }

/** The notification centre. Opens as a panel under the bell on desktop and a bottom sheet on phones. Items link straight to where the problem is fixed. */
export function NotificationBell({ notices }: { notices: Notice[] }) {
  const router = useRouter(); const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { const f = () => setOpen(true); addEventListener('oss:notices', f); return () => removeEventListener('oss:notices', f); }, []); const [open, setOpen] = useState(false); const narrow = useNarrow(); const [, start] = useTransition();
  const unread = notices.filter(n => !n.read); const fresh = unread, earlier = notices.filter(n => n.read);
  const mark = (ids: string[] | 'all') => start(async () => { await markNoticesRead(ids); router.refresh(); });
  const body = (<div className="nlist">
    <div className="nhead"><h2>Notifications</h2>{unread.length > 0 && <button type="button" className="btn sm ghost" onClick={() => mark('all')}><CheckCheck size={15} aria-hidden />Mark all read</button>}</div>
    {notices.length === 0 ? <div className="nempty"><CircleCheck size={26} aria-hidden /><b>You are all caught up</b><span>Orders, stock and payment issues that need you will show up here.</span></div> : (<>
      {fresh.length > 0 && <section aria-label="New"><h3>New</h3><ul>{fresh.map(n => <Item key={n.id} n={n} onGo={() => { setOpen(false); mark([n.id]); }} />)}</ul></section>}
      {earlier.length > 0 && <section aria-label="Earlier"><h3>Earlier</h3><ul>{earlier.map(n => <Item key={n.id} n={n} onGo={() => setOpen(false)} />)}</ul></section>}</>)}
    <div className="nfoot"><Link href="/settings/preferences" onClick={() => setOpen(false)}>Choose what you are told about</Link></div>
  </div>);
  return (<>
    <button ref={btn} type="button" className="iconbtn" aria-haspopup="dialog" aria-expanded={open} aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'} onClick={() => setOpen(o => !o)}>
      <Bell size={18} aria-hidden />{unread.length > 0 && <span className="count" aria-hidden>{unread.length > 9 ? '9+' : unread.length}</span>}
    </button>
    {narrow ? <Dialog open={open} onClose={() => setOpen(false)} title="Notifications">{body}</Dialog> : <Popover open={open} onClose={() => setOpen(false)} anchor={btn} label="Notifications" width={400}>{body}</Popover>}
  </>);
}
function Item({ n, onGo }: { n: Notice; onGo: () => void }) {
  return (<li className={n.read ? 'read' : ''}><Link href={n.href} onClick={onGo} className="nitem"><NoticeIcon tone={n.tone} /><span className="nt"><b>{n.title}</b><span>{n.body}</span><small>{ago(n.at)} · {n.action}</small></span>{!n.read && <span className="udot" aria-label="Unread" />}</Link></li>);
}

/** Alerts at the top of Overview: only things that need action now, each with its own button and a way to dismiss. */
export function AlertStack({ notices, total }: { notices: Notice[]; total: number }) {
  const router = useRouter(); const [gone, setGone] = useState<Set<string>>(new Set()); const [, start] = useTransition();
  const live = notices.filter(n => !gone.has(n.id)); const shown = live.slice(0, 2); const hidden = Math.max(total - shown.length - gone.size, 0); if (!shown.length) return null;
  return (<section aria-label="Needs your attention" className="alerts">{shown.map(n => { const I = ICON[n.tone]; return (
    <div key={n.id} className={`alert ${n.tone}`} role={n.tone === 'danger' ? 'alert' : 'status'}>
      <span className="aic" aria-hidden><I size={20} /></span>
      <div className="abody"><b>{n.title}</b><p>{n.body}</p></div>
      <div className="aact"><Link href={n.href} className="btn sm">{n.action}</Link><button type="button" className="iconbtn sm" aria-label={`Dismiss: ${n.title}`} onClick={() => { setGone(g => new Set(g).add(n.id)); start(async () => { await markNoticesRead([n.id]); router.refresh(); }); }}><X size={15} aria-hidden /></button></div>
    </div>); })}{hidden > 0 && <button type="button" className="alerts-more" onClick={() => dispatchEvent(new Event('oss:notices'))}>{hidden} more in notifications</button>}</section>);
}
