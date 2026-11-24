'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { SEGMENTS, matches, type SegmentKey } from '@/lib/customers';
import { money, day } from '@/lib/format';
import type { Customer } from '@/lib/gateway';

type Sort = 'recent' | 'spent' | 'orders' | 'name';
/** Search, filter by segment, and sort. Every row opens the customer. */
export function CustomerList({ customers, segments, counts }: { customers: Customer[]; segments: Record<string, SegmentKey[]>; counts: Record<SegmentKey, number> }) {
  const [q, setQ] = useState(''); const [seg, setSeg] = useState<SegmentKey>('all'); const [sort, setSort] = useState<Sort>('recent');
  const rows = useMemo(() => customers.filter(c => segments[c.id]?.includes(seg) && matches(c, q)).sort((a, b) => sort === 'spent' ? b.spentMinor - a.spentMinor : sort === 'orders' ? b.orders - a.orders : sort === 'name' ? a.name.localeCompare(b.name) : b.lastOrder.localeCompare(a.lastOrder)), [customers, segments, seg, q, sort]);
  return (<>
    <div className="cl-bar">
      <div className="cl-search"><Search size={16} aria-hidden /><input type="search" aria-label="Search customers" placeholder="Search by name or email" value={q} onChange={e => setQ(e.target.value)} /></div>
      <label className="cl-sort">Sort by<select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="recent">Most recent order</option><option value="spent">Most spent</option><option value="orders">Most orders</option><option value="name">Name</option></select></label>
    </div>
    <div className="cl-seg" role="tablist" aria-label="Customer groups">{SEGMENTS.map(s => <button key={s.key} role="tab" aria-selected={seg === s.key} title={s.hint} onClick={() => setSeg(s.key)}>{s.label}<span className="num">{counts[s.key]}</span></button>)}</div>
    <div className="w tw">
      {rows.length === 0 ? <p className="muted" style={{ padding: 24, textAlign: 'center' }}>{q ? `No customers match “${q}”.` : 'No customers in this group right now.'}</p> : <>
        <table className="t"><thead><tr><th scope="col">Customer</th><th scope="col" className="r">Orders</th><th scope="col" className="r">Spent</th><th scope="col" className="r">Last order</th></tr></thead>
          <tbody>{rows.map((c, i) => <tr key={c.id} className="rowlink"><td><Link href={`/customers/${c.id}`} className="cl-name"><Avatar name={c.name} i={i} /><span><b style={{ fontWeight: 600 }}>{c.name}</b><div className="muted">{c.email}</div></span></Link></td><td className="r num">{c.orders}</td><td className="r num">{money(c.spentMinor)}</td><td className="r muted">{c.lastOrder ? day(c.lastOrder) : '—'}</td></tr>)}</tbody></table>
        <div className="cards">{rows.map(c => <Link key={c.id} href={`/customers/${c.id}`}><b>{c.name}</b><b className="num">{money(c.spentMinor)}</b><span className="muted">{c.email}</span><span className="muted" style={{ textAlign: 'right' }}>{c.orders} order{c.orders === 1 ? '' : 's'}</span></Link>)}</div></>}
    </div>
  </>);
}
