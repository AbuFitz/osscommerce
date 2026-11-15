/** Small, strict CSV: quotes, escaped quotes, commas and newlines inside quoted cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false; const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row); return rows;
}
/** Spreadsheet programs run cells that start with = + - @ as formulas. Exported text is neutralised so a customer called "=HYPERLINK(...)" cannot do harm. */
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
export const toCsv = (rows: (string | number)[][]) => rows.map(r => r.map(c => { const s = safe(String(c)); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';

export interface ParsedProduct { title: string; priceMinor: number; sku?: string; status: 'draft' | 'published'; onHand: number }
export type ImportResult = { rows: ParsedProduct[]; problems: { line: number; message: string }[]; missing: string[] };
const ALIAS: Record<string, string> = { name: 'title', product: 'title', 'product name': 'title', price: 'price', 'price (gbp)': 'price', sku: 'sku', status: 'status', stock: 'stock', quantity: 'stock', qty: 'stock', 'on hand': 'stock' };
export function parseProducts(text: string, max = 500): ImportResult {
  const all = parseCsv(text); if (!all.length) return { rows: [], problems: [], missing: ['title', 'price'] };
  const head = all[0].map(h => ALIAS[h.trim().toLowerCase()] ?? h.trim().toLowerCase()); const col = (n: string) => head.indexOf(n);
  const missing = ['title', 'price'].filter(n => col(n) < 0); if (missing.length) return { rows: [], problems: [], missing };
  const rows: ParsedProduct[] = [], problems: { line: number; message: string }[] = []; const seen = new Set<string>();
  all.slice(1, max + 1).forEach((r, i) => {
    const line = i + 2, title = (r[col('title')] ?? '').trim(), price = (r[col('price')] ?? '').replace(/[£,\s]/g, '');
    if (!title) return void problems.push({ line, message: 'Missing title' });
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return void problems.push({ line, message: `"${title}": price "${r[col('price')] ?? ''}" is not an amount like 12.50` });
    const stock = col('stock') >= 0 ? (r[col('stock')] ?? '').trim() : '0'; if (stock && !/^\d+$/.test(stock)) return void problems.push({ line, message: `"${title}": stock "${stock}" is not a whole number` });
    const sku = col('sku') >= 0 ? (r[col('sku')] ?? '').trim().toUpperCase() : ''; if (sku) { if (seen.has(sku)) return void problems.push({ line, message: `"${title}": SKU ${sku} appears twice in this file` }); seen.add(sku); }
    const status = col('status') >= 0 && /^publish/i.test((r[col('status')] ?? '').trim()) ? 'published' : 'draft';
    rows.push({ title, priceMinor: Math.round(Number(price) * 100), sku: sku || undefined, status, onHand: stock ? Number(stock) : 0 });
  });
  if (all.length - 1 > max) problems.push({ line: max + 2, message: `Only the first ${max} rows are imported at a time` });
  return { rows, problems, missing: [] };
}
