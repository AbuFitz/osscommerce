'use client';
import { useState, useTransition } from 'react';
import { useToast } from '@oss-commerce/ui';
import { saveStockSettingsAction } from '@/app/actions';
import type { StockSettings } from '@/lib/gateway';

export function StockSettingsForm({ id, initial }: { id: string; initial: StockSettings }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [s, setS] = useState({ tracked: initial.tracked, backorder: initial.backorder, lowAt: String(initial.lowAt) });
  const n = Number(s.lowAt); const bad = s.lowAt.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100_000; const dirty = s.tracked !== initial.tracked || s.backorder !== initial.backorder || n !== initial.lowAt;
  return (<form className="fd" noValidate onSubmit={e => { e.preventDefault(); if (bad) return; start(async () => { const r = await saveStockSettingsAction(id, { tracked: s.tracked, backorder: s.backorder, lowAt: n }); toast(r.message, r.ok ? 'ok' : 'error'); }); }}>
    <label className="check1"><input type="checkbox" checked={s.tracked} onChange={e => setS({ ...s, tracked: e.target.checked })} /> Count stock for this item</label>
    <p className="muted pf-note" style={{ marginTop: -8 }}>Untick for things you never run out of, such as a service or something made to order. It can always be bought.</p>
    <label className="check1"><input type="checkbox" checked={s.backorder} disabled={!s.tracked} onChange={e => setS({ ...s, backorder: e.target.checked })} /> Keep selling when it runs out</label>
    <p className="muted pf-note" style={{ marginTop: -8 }}>Customers can order more than you hold, and you restock to fulfil. Off means the shop stops selling at zero.</p>
    <div className={`field${bad ? ' bad' : ''}`}><label htmlFor="ss-low">Low stock alert at</label><input id="ss-low" inputMode="numeric" value={s.lowAt} disabled={!s.tracked} onChange={e => setS({ ...s, lowAt: e.target.value })} aria-invalid={bad} />{bad ? <p className="ferr" role="alert">A whole number from 0 to 100,000.</p> : <p className="fhint muted">You are warned when this many or fewer can still be sold.</p>}</div>
    <button className="btn primary" type="submit" disabled={pending || bad || !dirty} aria-busy={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
  </form>);
}
