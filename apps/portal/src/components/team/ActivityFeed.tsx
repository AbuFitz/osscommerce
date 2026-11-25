'use client';
import { useState, useTransition } from 'react';
import type { ActivityEntry } from '@/lib/gateway';
import { moreActivity } from '@/app/actions';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dot = (a: string) => a.startsWith('order') ? 'sky' : a.startsWith('staff') ? 'rose' : a.startsWith('product') || a.startsWith('collection') ? 'indigo' : a.startsWith('discount') || a.startsWith('promotion') ? 'amber' : 'teal';

/** Newest first. Older entries load on request, so the page stays quick however long the history is. */
export function ActivityFeed({ first, hasMore, actor }: { first: ActivityEntry[]; hasMore: boolean; actor?: string }) {
  const [items, setItems] = useState(first); const [more, setMore] = useState(hasMore); const [pending, start] = useTransition();
  const load = () => start(async () => { const p = await moreActivity(items[items.length - 1].id, actor); setItems(i => [...i, ...p.items]); setMore(p.hasMore); });
  if (!items.length) return <p className="muted" style={{ padding: '8px 2px' }}>Nothing yet. Changes your team makes will appear here.</p>;
  return (<>
    <ol className="act-list">{items.map(e => <li key={e.id}><i className={`dot ${dot(e.action)}`} aria-hidden /><span className="t"><b>{e.summary}</b><span className="muted">{e.actor}</span></span><time dateTime={e.at}>{fmt(e.at)}</time></li>)}</ol>
    {more && <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn" type="button" onClick={load} disabled={pending} aria-busy={pending}>{pending ? 'Loading…' : 'Show older'}</button></div>}
  </>);
}
