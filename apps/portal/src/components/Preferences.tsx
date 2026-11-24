'use client';
import { useEffect, useState } from 'react';
import { Toggle } from '@oss-commerce/ui';
import { Dialog } from '@oss-commerce/ui';
import { useRun } from './Actions';
import { savePreferences } from '@/app/actions';
import type { Preferences as Prefs } from '@/lib/gateway';

/** Pattern for every settings form: edit freely, a save bar appears when dirty, leaving with unsaved edits warns. Risky switches confirm first. */
export function Preferences({ initial }: { initial: Prefs }) {
  const [saved, setSaved] = useState<Prefs>(initial);
  const [v, setV] = useState<Prefs>(initial);
  const [confirmPause, setConfirmPause] = useState(false);
  const { run, pending } = useRun();
  const dirty = (Object.keys(v) as (keyof Prefs)[]).some(k => v[k] !== saved[k]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const set = (k: keyof Prefs) => (x: boolean) => setV(p => ({ ...p, [k]: x }));
  return (
    <>
      <div className="grid">
        <section className="w c-6" aria-labelledby="p1"><h2 id="p1" style={{ marginBottom: 6 }}>Email alerts</h2>
          <Toggle label="New orders" description="One email for each order." checked={v.newOrder} onChange={set('newOrder')} />
          <Toggle label="Low stock" description="When a product reaches its alert level." checked={v.lowStock} onChange={set('lowStock')} /></section>
        <section className="w c-6" aria-labelledby="p2"><h2 id="p2" style={{ marginBottom: 6 }}>Checkout</h2>
          <Toggle label="Guest checkout" description="Customers can buy without an account." checked={v.guest} onChange={set('guest')} />
          <Toggle label="Ask for marketing consent" description="A separate, unticked box. Receipts are always sent." checked={v.consent} onChange={set('consent')} />
          <Toggle label="Show sold-out products" description="Keep them visible with a sold-out label." checked={v.showSoldOut} onChange={set('showSoldOut')} /></section>
        <section className="w c-12 tint-yellow" aria-labelledby="p3"><h2 id="p3" style={{ marginBottom: 6 }}>Pause checkout</h2>
          <Toggle label="Pause new orders" description="Your storefront stays online but customers cannot check out. Existing orders are not affected." checked={v.pause}
            onChange={x => (x ? setConfirmPause(true) : set('pause')(false))} /></section>
      </div>
      {dirty && (
        <div className="savebar" role="region" aria-label="Unsaved changes"><span>You have unsaved changes</span>
          <span className="acts"><button className="btn sm" type="button" onClick={() => setV(saved)}>Discard</button>
            <button className="btn sm primary" type="button" disabled={pending} onClick={() => run(() => savePreferences(v), () => setSaved(v))}>{pending ? 'Saving…' : 'Save changes'}</button></span></div>)}
      <Dialog open={confirmPause} onClose={() => setConfirmPause(false)} title="Pause new orders?" description="Customers will see that checkout is unavailable until you turn this off."
        footer={<><button className="btn" type="button" onClick={() => setConfirmPause(false)}>Keep checkout on</button><button className="btn primary" type="button" onClick={() => { set('pause')(true); setConfirmPause(false); }}>Pause checkout</button></>}><span /></Dialog>
    </>
  );
}
