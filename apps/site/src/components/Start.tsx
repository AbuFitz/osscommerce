'use client';
import { createContext, useContext, useState } from 'react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { SITE } from '@/config';

const Ctx = createContext<() => void>(() => {});
export const useStart = () => useContext(Ctx);

export function StartButton({ children = 'Join the pilot', className = 'btn brand' }: { children?: React.ReactNode; className?: string }) {
  const open = useStart();
  return <button type="button" className={className} onClick={open}>{children}</button>;
}

const PLATFORMS = ['Not selling online yet', 'Shopify', 'IONOS', 'Wix', 'Squarespace', 'WooCommerce', 'Etsy or marketplace', 'Something else'];
const SALES = ['Under £1,000', '£1,000 to £5,000', '£5,000 to £20,000', 'Over £20,000', 'Not sure yet'];

/** Nothing is sent from the page: it composes an email in the visitor's own mail app. The dialog says so. */
export function StartProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', business: '', platform: PLATFORMS[0], sales: SALES[4], notes: '' });
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email);
  const valid = f.name.trim().length > 1 && emailOk;
  const body = `Name: ${f.name}\nEmail: ${f.email}\nBusiness: ${f.business || '-'}\nSelling on: ${f.platform}\nMonthly online sales: ${f.sales}\n\n${f.notes}`;
  const href = `mailto:${SITE.email}?subject=${encodeURIComponent('Commerce pilot enquiry')}&body=${encodeURIComponent(body)}`;
  const send = () => { setTried(true); if (!valid) return; window.location.href = href; toast(`Your email app should open. If it does not, write to ${SITE.email}.`, 'info'); setOpen(false); };
  const copy = async () => { setTried(true); if (!valid) return; try { await navigator.clipboard.writeText(body); toast('Details copied. Paste them into an email to ' + SITE.email + '.'); } catch { toast(`Could not copy. Email ${SITE.email} instead.`, 'error'); } };
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} title="Join the pilot" description="Tell us a little about your shop. We reply personally, usually within one working day."
        footer={<><button className="btn" type="button" onClick={copy}>Copy details</button><button className="btn primary" type="button" onClick={send}>Open email to send</button></>}>
        <div className="row2">
          <div className="field"><label htmlFor="s-n">Your name</label><input id="s-n" autoComplete="name" value={f.name} onChange={set('name')} aria-invalid={tried && f.name.trim().length < 2} /></div>
          <div className="field"><label htmlFor="s-e">Email</label><input id="s-e" type="email" autoComplete="email" value={f.email} onChange={set('email')} aria-invalid={tried && !emailOk} />{tried && !emailOk && <small className="err">Enter a valid email address.</small>}</div>
        </div>
        <div className="field"><label htmlFor="s-b">Business or shop name <span className="muted">(optional)</span></label><input id="s-b" autoComplete="organization" value={f.business} onChange={set('business')} /></div>
        <div className="row2">
          <div className="field"><label htmlFor="s-p">Where do you sell now?</label><select id="s-p" value={f.platform} onChange={set('platform')}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="field"><label htmlFor="s-s">Monthly online sales</label><select id="s-s" value={f.sales} onChange={set('sales')}>{SALES.map(p => <option key={p}>{p}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="s-t">Anything we should know? <span className="muted">(optional)</span></label><textarea id="s-t" value={f.notes} onChange={set('notes')} /></div>
        <p className="muted" style={{ fontSize: 13 }}>Nothing is sent from this page. The button opens your own email app with these details filled in.</p>
      </Dialog>
    </Ctx.Provider>
  );
}
