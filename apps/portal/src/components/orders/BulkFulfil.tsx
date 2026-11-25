'use client';
import { useState, useTransition } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { fulfilMany } from '@/app/actions';

/** Marks every paid, unshipped order in the current list as fulfilled in one go. Each order is handled on its own, so one that cannot be fulfilled never stops the rest. */
export function BulkFulfil({ ids, numbers }: { ids: string[]; numbers: number[] }) {
  const [open, setOpen] = useState(false); const toast = useToast(); const [pending, start] = useTransition();
  const go = () => start(async () => { const r = await fulfilMany(ids); toast(r.message, r.ok ? 'ok' : 'error'); setOpen(false); });
  const shown = numbers.slice(0, 8).map(n => `#${n}`).join(', ') + (numbers.length > 8 ? ` and ${numbers.length - 8} more` : '');
  return (<>
    <button className="btn primary" type="button" onClick={() => setOpen(true)}>Fulfil all {ids.length}</button>
    <Dialog open={open} onClose={() => !pending && setOpen(false)} title={`Fulfil ${ids.length} order${ids.length === 1 ? '' : 's'}?`} description="Every item on each order is marked as sent, and each customer is emailed a shipping confirmation. Use an order's own page to add tracking or send part of it."
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className="btn primary" type="button" onClick={go} disabled={pending} aria-busy={pending}>{pending ? 'Fulfilling…' : `Fulfil ${ids.length}`}</button></>}>
      <p className="muted" style={{ margin: 0 }}>{shown}</p>
    </Dialog>
  </>);
}
