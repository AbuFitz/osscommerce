'use server';
import { revalidatePath } from 'next/cache';
import { gateway } from '@/lib/gateway-instance';
import type { OptionGroup, VariantInput, NewProduct, NewDiscount, ZoneInput, StockAdjust, MutationResult, RefundInput, Member, LegalPage, ServiceRequest, EmailSettings } from '@/lib/gateway';

/** Every mutation passes through here: one place to add session, membership, operation and audit checks. */
async function run(fn: () => Promise<MutationResult>, paths: string[]): Promise<MutationResult> {
  try { const r = await fn(); if (r.ok) paths.forEach(p => revalidatePath(p)); return r; }
  catch { return { ok: false, message: 'That did not go through. Nothing was changed. Try again, or contact support.' }; }
}
export async function fulfilOrder(id: string, tracking?: string) { return run(() => gateway().fulfilOrder(id, tracking), ['/orders', '/']); }
export async function refundOrder(i: RefundInput) { return run(() => gateway().refundOrder(i), ['/orders', '/']); }
export async function inviteMember(email: string, role: Member['role']) { return run(() => gateway().inviteMember(email, role), ['/settings/team']); }
export async function rollbackTheme(v: string) { return run(() => gateway().rollbackTheme(v), ['/storefront']); }
export async function decideGrant(id: string, d: 'approve' | 'decline' | 'revoke') { return run(() => gateway().decideGrant(id, d), ['/settings/team']); }
export async function savePreferences(p: Record<string, boolean>) { return run(() => gateway().savePreferences(p), ['/settings/preferences']); }
export async function saveSection(id: string, fields: Record<string, string>) { return run(() => gateway().saveSection(id, fields), ['/content']); }
export async function publishContent() { return run(() => gateway().publishContent(), ['/content']); }
export async function saveLegal(slug: LegalPage['slug'], body: string, publish: boolean) { return run(() => gateway().saveLegal(slug, body, publish), ['/settings/legal']); }
export async function setAutomation(id: string, on: boolean) { return run(() => gateway().setAutomation(id, on), ['/automations']); }
export async function createServiceRequest(kind: ServiceRequest['kind'], title: string, detail: string) { return run(() => gateway().createServiceRequest(kind, title, detail), ['/support']); }
export async function decideQuote(id: string, approve: boolean) { return run(() => gateway().decideQuote(id, approve), ['/support']); }
export async function saveEmailSettings(brand: Partial<EmailSettings['brand']>, n: Record<string, boolean>) { return run(() => gateway().saveEmailSettings(brand, n), ['/settings/emails']); }

export async function startPaymentSetup() { return gateway().startPaymentSetup(); }

// ---- Phone handoff (add photos from your phone) ----
import { handoff, callerNow, origin, qrSvg, AVAILABLE, photoStore } from '@/lib/handoff';
import { HandoffError } from '@oss-commerce/handoff';
const fail = (e: unknown) => ({ ok: false as const, message: e instanceof HandoffError ? e.message : 'Something went wrong. Nothing was changed.' });
export async function startPhoneHandoff(productId: string, label: string) {
  if (!AVAILABLE) return { ok: false as const, message: 'Adding photos from your phone is available once your store is live on the platform.' };
  try { const h = await handoff().create(await callerNow(), { kind: 'product_photos', productId, label }); const url = `${await origin()}/h/${h.token}`; return { ok: true as const, id: h.id, url, svg: await qrSvg(url), expiresAt: h.expiresAt, localhost: /localhost|127\.0\.0\.1/.test(url) }; } catch (e) { return fail(e); }
}
export async function pollPhoneHandoff(id: string) { try { return { ok: true as const, ...(await handoff().status(await callerNow(), id)) }; } catch (e) { return fail(e); } }
export async function closePhoneHandoff(id: string, as: 'completed' | 'cancelled') { try { return { ok: true as const, ...(await handoff().close(await callerNow(), id, as)) }; } catch (e) { return fail(e); } }
export async function listProductPhotos(productId: string) { return photoStore().list((await callerNow()).storeId, productId); }
import { sniff, stripMetadata, mime, MAX_FILE_BYTES } from '@oss-commerce/handoff';
/** Photos picked on this computer go through the same checks as phone photos: content sniffed, metadata stripped, size limited. */
export async function uploadPhotos(productId: string, form: FormData) {
  if (!AVAILABLE) return { ok: false as const, message: 'Photo upload is available once your store is live on the platform.' };
  const c = await callerNow(); let added = 0; const problems: string[] = [];
  for (const f of form.getAll('file')) {
    if (!(f instanceof File)) continue; const bytes = new Uint8Array(await f.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) { problems.push(`${f.name} is over 12 MB`); continue; }
    const t = sniff(bytes); if (!t) { problems.push(`${f.name} is not a JPEG, PNG or WebP photo`); continue; }
    try { await photoStore().put(c.storeId, productId, Math.random().toString(36).slice(2, 12) + Date.now().toString(36), stripMetadata(bytes, t), mime(t)); added++; } catch { problems.push(`${f.name} could not be read`); }
  }
  revalidatePath(`/products/${productId}`);
  return { ok: added > 0, message: added ? `${added} photo${added > 1 ? 's' : ''} added${problems.length ? `. ${problems.join('. ')}.` : ''}` : problems.join('. ') || 'No photos were added.' };
}

// ---- Catalogue, stock, discounts, shipping, storefront ----
export async function addProduct(p: NewProduct) { return run(() => gateway().addProduct(p), ['/products', '/inventory', '/']); }
export async function importProducts(rows: NewProduct[]) { return run(() => gateway().importProducts(rows), ['/products', '/inventory', '/']); }
export async function adjustStock(a: StockAdjust) { return run(() => gateway().adjustStock(a), ['/inventory', '/products', '/']); }
export async function createDiscount(d: NewDiscount) { return run(() => gateway().createDiscount(d), ['/discounts']); }
export async function saveZone(z: ZoneInput) { return run(() => gateway().saveZone(z), ['/settings/shipping']); }
export async function checkDomain() { const r = await gateway().checkDomain(); revalidatePath('/storefront'); return r; }
export async function requestLaunch() { return run(() => gateway().requestLaunch(), ['/storefront', '/']); }
/** CSV of customers for the signed-in store. Marketing consent is included so a mailing list can honour it. */
export async function exportCustomers() {
  const { toCsv } = await import('@/lib/csv'); const cs = await gateway().customers();
  return { filename: `customers-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv([['Name', 'Email', 'Orders', 'Total spent (GBP)', 'Last order', 'Marketing consent'], ...cs.map(c => [c.name, c.email, c.orders, (c.spentMinor / 100).toFixed(2), c.lastOrder.slice(0, 10), c.marketing ? 'Yes' : 'No'])]), count: cs.length };
}

export async function markNoticesRead(ids: string[] | 'all') { const r = await gateway().markNoticesRead(ids); revalidatePath('/', 'layout'); return r; }

export async function saveVariants(productId: string, d: { optionGroups: OptionGroup[]; variants: VariantInput[] }) { try { return await run(() => gateway().saveVariants(productId, d), [`/products/${productId}`, '/products', '/inventory', '/']); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save variants.' }; } }
export async function previewCollection(contains: string) { return gateway().previewCollection(contains); }
export async function createCollection(name: string, contains: string) { return run(() => gateway().createCollection(name, contains), ['/collections']); }

export interface SearchHit { kind: 'Order' | 'Product' | 'Customer'; title: string; sub: string; href: string }
/** Read-only search across orders, products and customers for the command palette. */
export async function searchAll(q: string): Promise<SearchHit[]> {
  const t = q.trim().toLowerCase(); if (t.length < 2) return [];
  try {
    const g = gateway(); const [o, p, c] = await Promise.all([g.orders({ q }), g.products(), g.customers()]);
    return [
      ...o.slice(0, 4).map(x => ({ kind: 'Order' as const, title: `#${x.number} · ${x.customer}`, sub: `${x.fulfilment}`, href: `/orders/${x.id}` })),
      ...p.filter(x => `${x.title} ${x.sku}`.toLowerCase().includes(t)).slice(0, 4).map(x => ({ kind: 'Product' as const, title: x.title, sub: x.sku, href: `/products/${x.id}` })),
      ...c.filter(x => `${x.name} ${x.email}`.toLowerCase().includes(t)).slice(0, 4).map(x => ({ kind: 'Customer' as const, title: x.name, sub: x.email, href: `/customers` })),
    ];
  } catch { return []; }
}
