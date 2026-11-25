'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowDownToLine, ChevronDown, PackageMinus, PackagePlus, ReceiptText, RotateCcw, Undo2 } from 'lucide-react';
import { when } from '@/lib/format';
import { reasonLabel } from '@/lib/stock';
import { olderStockMoves } from '@/app/actions';
import type { StockMove } from '@/lib/gateway';

const TEXT = { sale: 'Sold and shipped', reserved: 'Set aside for an order', released: 'Released from a cancelled order', returned: 'Back in stock from a cancelled order', adjusted: 'Changed by hand' } as const;
const ICON = { sale: ReceiptText, reserved: ArrowDownToLine, released: Undo2, returned: RotateCcw, adjusted: PackagePlus } as const;

/** Every sale, reservation and change, newest first, each linked to its order. Older history loads a page at a time, so a busy item is never cut off. */
export function StockHistory({ variantId, first, total }: { variantId: string; first: StockMove[]; total: number }) {
  const [moves, setMoves] = useState(first); const [page, setPage] = useState(0); const [pending, start] = useTransition(); const [done, setDone] = useState(first.length >= total);
  const older = () => start(async () => { const next = await olderStockMoves(variantId, page + 1); if (!next.length) { setDone(true); return; } setMoves(m => [...m, ...next]); setPage(p => p + 1); if (moves.length + next.length >= total) setDone(true); });
  if (!moves.length) return <p className="muted">Nothing yet. Every sale, reservation and change you make appears here.</p>;
  return (<>
    <ol className="sm-list">{moves.map(m => { const I = m.kind === 'adjusted' && m.quantity < 0 ? PackageMinus : ICON[m.kind]; return (
      <li key={m.id}><span className="ic lime"><I size={16} aria-hidden /></span>
        <span className="t"><b>{TEXT[m.kind]}{m.orderId && m.kind !== 'adjusted' && <> · <Link className="link" href={`/orders/${m.orderId}`}>Order #{m.orderCode ?? ''}</Link></>}</b>
          <span className="muted">{m.kind === 'adjusted' ? [m.reason && reasonLabel(m.reason), m.by, m.note].filter(Boolean).join(' · ') || 'No reason recorded (made before reasons were kept, or by an automatic rule)' : ''}</span></span>
        <span className="r"><b className="num">{m.kind === 'adjusted' ? `${m.quantity > 0 ? '+' : ''}${m.quantity}` : m.kind === 'sale' || m.kind === 'reserved' ? `−${m.quantity}` : `+${m.quantity}`}</b><span className="muted">{when(m.at)}</span></span></li>); })}</ol>
    <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>Showing {moves.length} of {total}.</p>
    {!done && <button type="button" className="btn" style={{ marginTop: 10 }} onClick={older} disabled={pending} aria-busy={pending}><ChevronDown size={15} aria-hidden />{pending ? 'Loading…' : 'Show older'}</button>}
  </>);
}
