'use client';
import { useId, useRef, useState, useTransition } from 'react';
import { Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, useToast } from '@oss-commerce/ui';
import { FormDialog } from './FormDialog';
import { parseProducts, type ImportResult } from '@/lib/csv';
import { addProduct, importProducts, adjustStock, createDiscount, checkDomain, requestLaunch, createServiceRequest, exportCustomers } from '@/app/actions';
import type { DomainCheck, Product, ShippingZone } from '@/lib/gateway';
const pence = (s: string) => Math.round(Number(s) * 100);

export function AddProduct({ triggerClass = 'btn primary' }: { triggerClass?: string }) {
  return <FormDialog trigger="Add product" triggerClass={triggerClass} title="Add product" description="Start with the basics. You can add photos from your phone on the next screen."
    fields={[{ name: 'title', label: 'Name', type: 'text', required: true, max: 120, placeholder: 'Stoneware mug, speckled' }, { name: 'price', label: 'Price', type: 'money', required: true, min: 0.01, hint: 'Including VAT if your prices include it.' },
      { name: 'sku', label: 'SKU', type: 'text', max: 40, hint: 'Optional. We make one from the name if you leave it blank.' }, { name: 'stock', label: 'In stock', type: 'number', min: 0, value: '0' },
      { name: 'status', label: 'Visibility', type: 'segmented', value: 'draft', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Publish now' }] }]}
    submit="Add product" onSubmit={v => addProduct({ title: v.title.trim(), priceMinor: pence(v.price), sku: v.sku?.trim() || undefined, onHand: Number(v.stock || 0), status: v.status as 'draft' | 'published' })} />;
}

export function ImportProducts() {
  const toast = useToast(); const [open, setOpen] = useState(false); const [res, setRes] = useState<ImportResult | null>(null); const [name, setName] = useState(''); const [pending, start] = useTransition(); const file = useRef<HTMLInputElement>(null);
  const read = async (f?: File) => { if (!f) return; if (f.size > 2_000_000) { toast('That file is over 2 MB. Split it into smaller files.', 'error'); return; } setName(f.name); setRes(parseProducts(await f.text())); };
  const close = () => { if (!pending) { setOpen(false); setRes(null); setName(''); } };
  const ok = res && res.rows.length > 0;
  return (<>
    <button className="btn" type="button" onClick={() => setOpen(true)}><Upload size={15} aria-hidden />Import CSV</button>
    <Dialog open={open} onClose={close} title="Import products" description="Upload a CSV with a title and price for each product. We check it first and show you any problems before anything is added."
      footer={<><button className="btn" type="button" onClick={close} disabled={pending}>Cancel</button><button className="btn primary" type="button" disabled={!ok || pending} aria-busy={pending} onClick={() => start(async () => { const r = await importProducts(res!.rows); toast(r.message, r.ok ? 'ok' : 'error'); if (r.ok) { setOpen(false); setRes(null); } })}>{pending ? 'Importing…' : ok ? `Import ${res!.rows.length} product${res!.rows.length > 1 ? 's' : ''}` : 'Import'}</button></>}>
      <div className="fd"><button type="button" className="drop" onClick={() => file.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void read(e.dataTransfer.files[0]); }}><Upload size={20} aria-hidden /><b>{name || 'Choose a CSV file'}</b><span>{name ? 'Choose a different file' : 'or drop it here. Columns: title, price, sku, status, stock'}</span></button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
        <a className="link" download="products-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('title,price,sku,status,stock\nStoneware mug,18.00,MUG-1,published,40\n')}`}><Download size={13} aria-hidden /> Download a template</a>
        {res && res.missing.length > 0 && <p className="ferr" role="alert"><AlertTriangle size={14} aria-hidden /> This file needs a {res.missing.join(' and ')} column.</p>}
        {res && !res.missing.length && <div className="imp" role="status"><p><CheckCircle2 size={15} aria-hidden /> <b>{res.rows.length}</b> ready to import{res.problems.length > 0 && <>, <b>{res.problems.length}</b> with problems that will be skipped</>}.</p>
          {res.problems.length > 0 && <ul>{res.problems.slice(0, 6).map(p => <li key={p.line}>Line {p.line}: {p.message}</li>)}{res.problems.length > 6 && <li>and {res.problems.length - 6} more</li>}</ul>}</div>}</div>
    </Dialog></>);
}

export function AdjustStock({ products }: { products: Product[] }) {
  const live = products.filter(p => p.status !== 'archived');
  return <FormDialog trigger="Adjust stock" triggerClass="btn primary" title="Adjust stock" description="Every change is logged with a reason, so your counts stay trustworthy."
    fields={[{ name: 'product', label: 'Product', type: 'select', required: true, value: live[0]?.id, options: live.map(p => ({ value: p.id, label: `${p.title} (${p.onHand} on hand)` })) },
      { name: 'mode', label: 'Change', type: 'segmented', value: 'add', options: [{ value: 'add', label: 'Add or remove' }, { value: 'set', label: 'Set to' }] },
      { name: 'qty', label: 'Quantity', type: 'number', required: true, hint: 'To remove stock, use a negative number, for example -3.' },
      { name: 'reason', label: 'Reason', type: 'select', required: true, value: 'recount', options: [{ value: 'recount', label: 'Stock count' }, { value: 'received', label: 'Delivery received' }, { value: 'damaged', label: 'Damaged or lost' }, { value: 'returned', label: 'Customer return' }, { value: 'other', label: 'Other' }] }]}
    submit="Save change" onSubmit={v => adjustStock({ productId: v.product, mode: v.mode as 'set' | 'add', qty: Number(v.qty), reason: v.reason as 'recount' })} />;
}

export function CreateDiscount() {
  return <FormDialog trigger="Create discount" triggerClass="btn primary" title="Create discount" description="Customers enter the code at checkout. It applies straight away."
    fields={[{ name: 'code', label: 'Code', type: 'text', required: true, max: 24, placeholder: 'SPRING10', hint: 'Letters and numbers. Customers type this, so keep it short.' },
      { name: 'kind', label: 'Type', type: 'segmented', value: 'percent', options: [{ value: 'percent', label: '% off' }, { value: 'fixed', label: '£ off' }, { value: 'shipping', label: 'Free delivery' }] },
      { name: 'pct', label: 'Percentage', type: 'number', required: true, min: 1, max: 100, showIf: v => v.kind === 'percent' }, { name: 'amt', label: 'Amount off', type: 'money', required: true, min: 0.01, showIf: v => v.kind === 'fixed' },
      { name: 'min', label: 'Minimum spend', type: 'money', hint: 'Optional.' }, { name: 'limit', label: 'Total uses', type: 'number', min: 1, hint: 'Optional. Leave blank for no limit.' }, { name: 'end', label: 'Ends on', type: 'date', hint: 'Optional.' }]}
    submit="Create discount" onSubmit={v => { if (!/^[A-Za-z0-9]+$/.test(v.code.trim())) return Promise.resolve({ ok: false, message: 'Codes can only use letters and numbers.' }); return createDiscount({ code: v.code.trim(), kind: v.kind as 'percent', value: v.kind === 'percent' ? Number(v.pct) : v.kind === 'fixed' ? pence(v.amt) : 0, minSpendMinor: v.min ? pence(v.min) : undefined, limit: v.limit ? Number(v.limit) : undefined, endDate: v.end || undefined }); }} />;
}

export function ExportCustomers({ count }: { count: number }) {
  const toast = useToast(); const [pending, start] = useTransition();
  return <button className="btn" type="button" disabled={pending || count === 0} aria-busy={pending} onClick={() => start(async () => {
    const r = await exportCustomers(); const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = r.filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${r.count} customers exported. Only email people who agreed to marketing.`, 'ok'); })}><Download size={15} aria-hidden />{pending ? 'Preparing…' : 'Export'}</button>;
}

export { ZoneDialog } from './ZoneEditor';

export function DomainCheckButton({ host }: { host: string }) {
  const toast = useToast(); const [pending, start] = useTransition(); const [r, setR] = useState<DomainCheck | null>(null);
  return (<div><button className="btn lime sm" type="button" disabled={pending} aria-busy={pending} onClick={() => start(async () => { const x = await checkDomain(); setR(x); toast(x.ok ? x.message : 'Not verified yet.', x.ok ? 'ok' : 'info'); })}>{pending ? 'Checking…' : 'Check domain'}</button>
    {r && !r.ok && r.record && <div className="dns" role="status"><p>{r.message}</p><dl className="kv"><dt>Type</dt><dd className="mono">{r.record.type}</dd><dt>Name</dt><dd className="mono">{r.record.name}</dd><dt>Points to</dt><dd className="mono">{r.record.value}</dd></dl><p className="muted">Add this at wherever you registered {host}.</p></div>}</div>);
}

export function LaunchRequest({ blockers, requested }: { blockers: string[]; requested?: boolean }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const can = blockers.length === 0;
  return (<>
    <button className="btn primary" type="button" onClick={() => setOpen(true)}>{requested ? 'Launch requested' : 'Request launch'}</button>
    <Dialog open={open} onClose={() => setOpen(false)} title={can ? 'Request launch' : 'Not ready to launch yet'} description={can ? 'We will run the final checks and confirm within one working day. Nothing goes live until you approve.' : 'Finish these first. Launch is blocked until they are done, so customers never hit a broken checkout.'}
      footer={<><button className="btn" type="button" onClick={() => setOpen(false)}>{can ? 'Not now' : 'Close'}</button>{can && <button className="btn primary" type="button" disabled={pending || requested} onClick={() => start(async () => { const r = await requestLaunch(); toast(r.message, r.ok ? 'ok' : 'error'); setOpen(false); })}>{pending ? 'Sending…' : 'Request launch'}</button>}</>}>
      {can ? <p style={{ margin: 0 }}>Everything on the checklist is done.</p> : <ul className="blockers">{blockers.map(b => <li key={b}><AlertTriangle size={15} aria-hidden />{b}</li>)}</ul>}
    </Dialog></>);
}

export function DesignChange() {
  return <FormDialog trigger="Request design change" triggerClass="btn ghost" title="Request a design change" description="Tell us what you would like changed. We reply with a fixed quote, and nothing is built or billed until you approve it."
    fields={[{ name: 'title', label: 'What would you like?', type: 'text', required: true, max: 100, placeholder: 'Add a gift-wrapping option' }, { name: 'detail', label: 'Details', type: 'textarea', required: true, max: 1000, hint: 'Where it should go, what it should say, anything we should know.' }]}
    submit="Send request" onSubmit={v => createServiceRequest('design_change', v.title.trim(), v.detail.trim())} />;
}
