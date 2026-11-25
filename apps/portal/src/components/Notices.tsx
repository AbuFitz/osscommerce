'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CircleAlert, TriangleAlert, Info, CircleCheck, CheckCheck, Check, X } from 'lucide-react';
import { Dialog } from '@oss-commerce/ui';
import { Popover } from './Popover';
import { markNoticesRead } from '@/app/actions';
import type { Notice } from '@/lib/gateway';

const ICON = { danger: CircleAlert, warn: TriangleAlert, info: Info, success: CircleCheck } as const;
const ago = (iso: string) => { const m = Math.round((Date.parse('2026-11-15T09:00:00Z') - Date.parse(iso)) / 60000); if (m < 60) return `${Math.max(m, 1)} min ago`; if (m < 1440) return `${Math.round(m / 60)} h ago`; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const useNarrow = () => { const [n, setN] = useState(false); useEffect(() => { const m = matchMedia('(max-width:767px)'); const f = () => setN(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []); return n; };


const KIND = { payment: 'Payments', stock: 'Inventory', order: 'Orders', access: 'Access', quote: 'Support', setup: 'Setup' } as const;

/** The notification centre. A panel under the bell on desktop, a bottom sheet on phones. Header and footer stay put while the list scrolls. */
export function NotificationBell({ notices }: { notices: Notice[] }) {
  const router = useRouter(); const btn = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false); const narrow = useNarrow(); const [, start] = useTransition();
  useEffect(() => { const f = () => setOpen(true); addEventListener('oss:notices', f); return () => removeEventListener('oss:notices', f); }, []);
  const unread = notices.filter(n => !n.read);
  const mark = (ids: string[] | 'all') => start(async () => { await markNoticesRead(ids); router.refresh(); });
  const markAll = unread.length > 0 ? <button type="button" className="iconbtn sm" aria-label="Mark all as read" title="Mark all as read" onClick={() => mark('all')}><CheckCheck size={17} aria-hidden /></button> : null;
  const foot = <Link href="/settings/preferences" onClick={() => setOpen(false)}>{notices.length ? 'Choose what you are told about' : 'Notification settings'}</Link>;
  const list = notices.length === 0
    ? <div className="nempty"><CircleCheck size={26} aria-hidden /><b>You are all caught up</b><span>Orders, stock and payment issues that need you will show up here.</span></div>
    : <ul className="nul">{notices.map(n => <Item key={n.id} n={n} onGo={() => { setOpen(false); if (!n.read) mark([n.id]); }} onRead={() => mark([n.id])} />)}</ul>;
  return (<>
    <button ref={btn} type="button" className="iconbtn" aria-haspopup="dialog" aria-expanded={open} aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'} onClick={() => setOpen(o => !o)}>
      <Bell size={18} aria-hidden />{unread.length > 0 && <span className="count" aria-hidden>{unread.length > 9 ? '9+' : unread.length}</span>}
    </button>
    {narrow
      ? <Dialog open={open} onClose={() => setOpen(false)} title="Notifications" actions={markAll} footer={<div className="nfoot">{foot}</div>}><div className="nlist">{list}</div></Dialog>
      : <Popover open={open} onClose={() => setOpen(false)} anchor={btn} label="Notifications" width={400}><div className="nlist nlist-pop"><div className="nhead"><h2>Notifications</h2>{markAll}</div><div className="nscroll" data-fade>{list}</div><div className="nfoot">{foot}</div></div></Popover>}
  </>);
}
function Item({ n, onGo, onRead }: { n: Notice; onGo: () => void; onRead: () => void }) {
  return (<li className={`nrow${n.read ? ' read' : ''}`}>
    <Link href={n.href} onClick={onGo} className="nitem">
      <span className="nmeta">{!n.read && <i className="udot" aria-label="Unread" />}{KIND[n.kind]} · {ago(n.at)}</span>
      <b>{n.title}</b><span className="nbody">{n.body}</span><span className="nact">{n.action}</span>
    </Link>
    {!n.read && <button type="button" className="ncheck" aria-label={`Mark as read: ${n.title}`} onClick={onRead}><Check size={16} aria-hidden /></button>}
  </li>);
}

/** A slim bar across the top of the app for account-level problems only (payments or payouts stopped, action due). One at a time, always links to the fix. Everything else lives in the notification centre. */
export interface BannerData { tone: 'danger' | 'warn'; title: string; body: string; href: string; action: string; id: string }
export function StatusBanner({ banner }: { banner: BannerData | null }) {
  const [gone, setGone] = useState(false); useEffect(() => { try { if (banner && sessionStorage.getItem('oss_banner') === banner.id) setGone(true); } catch {} }, [banner]);
  if (!banner || gone) return null; const I = ICON[banner.tone];
  return (<div className={`sbanner ${banner.tone}`} role={banner.tone === 'danger' ? 'alert' : 'status'}>
    <I size={18} aria-hidden /><p><b>{banner.title}</b> <span>{banner.body}</span></p>
    <Link href={banner.href} className="sb-act">{banner.action}</Link>
    {banner.tone === 'warn' && <button type="button" className="sb-x" aria-label={`Dismiss: ${banner.title}`} onClick={() => { setGone(true); try { sessionStorage.setItem('oss_banner', banner.id); } catch {} }}><X size={15} aria-hidden /></button>}
  </div>);
}
