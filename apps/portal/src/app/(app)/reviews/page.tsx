import Link from 'next/link';
import { Star } from 'lucide-react';
import { gateway } from '@/lib/gateway-instance';
import { gate } from '@/lib/gate';
import { when } from '@/lib/format';
import { Header } from '@/components/ui';
import { ReviewActions } from '@/components/reviews/ReviewActions';
import type { ReviewStatus } from '@/lib/gateway';
export const metadata = { title: 'Reviews' };
const TABS: [string, string][] = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];
const stars = (n: number) => <span className="stars" role="img" aria-label={`${n} out of 5 stars`}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={15} aria-hidden fill={i <= n ? 'currentColor' : 'none'} />)}</span>;

export default async function Reviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await gate('/reviews'); const { status = 'pending' } = await searchParams; const st = (['pending', 'approved', 'rejected'].includes(status) ? status : '') as ReviewStatus | '';
  const page = await gateway().reviews(st || undefined);
  return (<><Header title="Reviews" eyebrow={page.pending ? `${page.pending} waiting for you` : 'Nothing waiting'} />
    <div className="toolbar"><nav className="seg" aria-label="Filter reviews">{TABS.map(([v, l]) => <Link key={v} href={v ? `/reviews?status=${v}` : '/reviews?status='} aria-current={st === v}>{l}{v === 'pending' && page.pending > 0 ? <span className="num" style={{ marginLeft: 6 }}>{page.pending}</span> : null}</Link>)}</nav></div>
    {page.items.length === 0 ? <div className="w empty"><b style={{ color: 'var(--ink)' }}>{st === 'pending' ? 'No reviews waiting' : 'No reviews here'}</b><p style={{ margin: '6px 0 0' }}>Shoppers can review a product after they buy. New reviews wait here until you approve them, so nothing shows on your store without your say.</p></div>
      : <ul className="rv-list">{page.items.map(r => (
        <li key={r.id} className="w rv">
          <div className="rv-top">{stars(r.rating)}<b>{r.title}</b>{r.status !== 'approved' && <span className={`badge ${r.status === 'pending' ? 'warn' : ''}`}>{r.status === 'pending' ? 'Waiting' : 'Rejected'}</span>}</div>
          <p className="rv-body">{r.body}</p>
          <p className="muted rv-meta">{r.authorName}{r.verified ? ' · Verified purchase' : ''} · {r.productName} · {when(r.at)}<span className="rv-mail"> · {r.email}</span></p>
          {r.reply && <p className="rv-reply"><b>Your reply</b> {r.reply}</p>}
          <ReviewActions r={r} />
        </li>))}</ul>}
    <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Reviews are plain text. A reviewer's email is for your eyes only, and is removed if you erase that customer.</p></>);
}
