'use server';
import { revalidatePath } from 'next/cache';
import type { SegmentDefinition } from '@oss-commerce/contracts';
import { gateway } from '@/lib/gateway-instance';
import type { OrderEditApply, OrderEditInput, StockSettings, VariantStockAdjust, ManualOrderInput, CustomerProfile, CollectionInput, DiscountInput, ImageUpload, ProductEdit, OptionGroup, VariantInput, NewProduct, NewDiscount, ZoneInput, StockAdjust, MutationResult, RefundInput, Member, LegalPage, ServiceRequest, EmailSettings, Preferences } from '@/lib/gateway';

/** Every mutation passes through here: one place to add session, membership, operation and audit checks. */
async function run(fn: () => Promise<MutationResult>, paths: string[]): Promise<MutationResult> {
  try { const r = await fn(); if (r.ok) paths.forEach(p => revalidatePath(p)); return r; }
  catch { return { ok: false, message: 'That did not go through. Nothing was changed. Try again, or contact support.' }; }
}
export async function fulfilOrder(id: string, tracking?: string, lines?: { sku: string; qty: number }[]) { return run(() => gateway().fulfilOrder(id, tracking?.trim().slice(0, 120) || undefined, lines), ['/orders', `/orders/${id}`, '/']); }
/** At most 50 at a time, one by one, so a single failure is reported and never hides the others. */
export async function fulfilMany(ids: string[]): Promise<MutationResult> {
  const list = [...new Set(ids)].slice(0, 50); let done = 0; const failed: string[] = [];
  for (const id of list) { try { const r = await gateway().fulfilOrder(id); if (r.ok) done++; else failed.push(r.message); } catch { failed.push('An order did not go through.'); } }
  ['/orders', '/', '/inventory'].forEach(p => revalidatePath(p));
  if (!failed.length) return { ok: true, message: `${done} order${done === 1 ? '' : 's'} marked as fulfilled.` };
  return { ok: done > 0, message: `${done} fulfilled, ${failed.length} not. ${failed[0]}` };
}
export async function cancelOrder(i: { orderId: string; reason: string; refund: boolean }) { return run(() => gateway().cancelOrder({ ...i, reason: i.reason.trim().slice(0, 200) }), ['/orders', `/orders/${i.orderId}`, '/', '/inventory']); }
export async function addOrderNote(orderId: string, note: string) { return run(() => gateway().addOrderNote(orderId, note), [`/orders/${orderId}`]); }
export async function refundOrder(i: RefundInput) { return run(() => gateway().refundOrder(i), ['/orders', '/', '/inventory']); }
export async function olderStockMoves(variantId: string, page: number) { return gateway().stockMoves(variantId, page); }
export async function orderableItemsAction() { return gateway().orderableItems(); }
export async function resolveOrderEdit(orderId: string, payment?: ManualOrderInput['payment']) { return run(() => gateway().resolveOrderEdit(orderId, payment), ['/orders', '/']); }
export async function previewOrderEdit(i: OrderEditInput) { return gateway().previewOrderEdit(i); }
export async function applyOrderEdit(i: OrderEditApply) { return run(() => gateway().applyOrderEdit(i), ['/orders', '/', '/inventory', '/analytics']); }
export async function inviteMember(i: { email: string; firstName: string; lastName: string; role: Exclude<Member['role'], 'owner'> }) { return run(() => gateway().inviteMember({ email: i.email.trim().slice(0, 200), firstName: i.firstName.trim().slice(0, 80), lastName: i.lastName.trim().slice(0, 80), role: i.role }), ['/settings/team', '/settings/activity']); }
export async function setMemberRole(id: string, role: Exclude<Member['role'], 'owner'>) { return run(() => gateway().setMemberRole(id, role), ['/settings/team', '/settings/activity']); }
export async function removeMember(id: string) { return run(() => gateway().removeMember(id), ['/settings/team', '/settings/activity']); }
export async function resendInvite(id: string) { return run(() => gateway().resendInvite(id), ['/settings/team']); }
export async function changePassword(current: string, next: string) { return run(() => gateway().changePassword(current, next), []); }
export async function moreActivity(before: number, actor?: string) { return gateway().activity({ before, actor }); }
export async function rollbackTheme(v: string) { return run(() => gateway().rollbackTheme(v), ['/storefront']); }
export async function decideGrant(id: string, d: 'approve' | 'decline' | 'revoke') {
  const { LIVE, recentlyAuthenticated } = await import('@/lib/session');
  if (LIVE && !await recentlyAuthenticated()) return { ok: false, message: 'Sign out and sign in again before changing support access.' };
  return run(() => gateway().decideGrant(id, d), ['/settings/team']);
}
export async function savePreferences(p: Preferences) { return run(() => gateway().savePreferences(p), ['/settings/preferences']); }
export async function saveSection(id: string, fields: Record<string, string>) { return run(() => gateway().saveSection(id, fields), ['/content']); }
export async function publishContent() { return run(() => gateway().publishContent(), ['/content']); }
export async function saveLegal(slug: LegalPage['slug'], body: string, publish: boolean) { return run(() => gateway().saveLegal(slug, body, publish), ['/settings/legal']); }
export async function setAutomation(id: string, on: boolean) { return run(() => gateway().setAutomation(id, on), ['/automations']); }
export async function createServiceRequest(kind: ServiceRequest['kind'], title: string, detail: string) { return run(() => gateway().createServiceRequest(kind, title, detail), ['/support']); }
export async function decideQuote(id: string, approve: boolean) {
  if (approve) { const { LIVE, recentlyAuthenticated } = await import('@/lib/session'); if (LIVE && !await recentlyAuthenticated()) return { ok: false, message: 'Sign out and sign in again before approving a paid quote.' }; }
  return run(() => gateway().decideQuote(id, approve), ['/support']);
}
export async function saveEmailSettings(brand: Partial<EmailSettings['brand']>, n: Record<string, boolean>) { return run(() => gateway().saveEmailSettings(brand, n), ['/settings/emails']); }

export async function startPaymentSetup() {
  const { LIVE, recentlyAuthenticated } = await import('@/lib/session');
  if (LIVE && !await recentlyAuthenticated()) return { ok: false as const, message: 'Sign out and sign in again before changing payment details.' };
  try { return await gateway().startPaymentSetup(); }
  catch { return { ok: false as const, message: 'Stripe could not be opened just now. Nothing was changed. Try again in a moment.' }; }
}

export async function startBillingPortal() {
  const { LIVE, recentlyAuthenticated } = await import('@/lib/session');
  if (LIVE && !await recentlyAuthenticated()) return { ok: false as const, message: 'Sign out and sign in again before changing billing details.' };
  try { return await gateway().startBillingPortal(); }
  catch { return { ok: false as const, message: 'Stripe billing could not be opened just now. Nothing was changed. Try again in a moment.' }; }
}

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


// ---- Product editor ----
const MAX_PHOTOS_PER_SAVE = 12;
/** Photos are judged by their content, not the name or type the browser claims, and stripped of metadata (location, camera) before they are stored. */
async function readImages(form: FormData): Promise<{ files: ImageUpload[]; problems: string[] }> {
  const files: ImageUpload[] = []; const problems: string[] = [];
  for (const f of form.getAll('file')) {
    if (!(f instanceof File) || f.size === 0) continue; if (files.length >= MAX_PHOTOS_PER_SAVE) { problems.push(`Only ${MAX_PHOTOS_PER_SAVE} photos can be added at once`); break; }
    const bytes = new Uint8Array(await f.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024) { problems.push(`${f.name} is over 10 MB`); continue; }
    const t = sniff(bytes); if (!t) { problems.push(`${f.name} is not a JPEG, PNG or WebP photo`); continue; }
    files.push({ name: f.name.slice(0, 120), type: mime(t), bytes: stripMetadata(bytes, t) });
  }
  return { files, problems };
}
const text = (form: FormData, k: string) => String(form.get(k) ?? '').trim();
const money = (s: string): number | null => (/^\d{1,7}(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : null);
const whole = (s: string): number | null => (/^\d{1,9}$/.test(s) ? Number(s) : null);
const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Creates a product with all its details and photos in one go. Everything is checked here again; the form's checks are for the merchant's convenience only. */
export async function createProductWithImages(form: FormData): Promise<MutationResult> {
  const title = text(form, 'title'); if (!title) return { ok: false, message: 'Give the product a name.' }; if (title.length > 120) return { ok: false, message: 'The name is over 120 characters.' };
  const price = money(text(form, 'price')); if (price === null) return { ok: false, message: 'Enter a price such as 18 or 18.50.' };
  const cmpRaw = text(form, 'compareAt'); const compareAt = cmpRaw ? money(cmpRaw) : undefined; if (cmpRaw && compareAt === null) return { ok: false, message: 'Enter the compare-at price such as 24 or 24.50.' };
  if (compareAt && compareAt <= price) return { ok: false, message: 'The compare-at price must be higher than the price.' };
  const stock = whole(text(form, 'stock') || '0'); if (stock === null) return { ok: false, message: 'Stock must be a whole number.' };
  const wRaw = text(form, 'weight'); const weight = wRaw ? whole(wRaw) : undefined; if (wRaw && weight === null) return { ok: false, message: 'Weight is a whole number of grams.' };
  const handle = text(form, 'handle'); if (handle && !HANDLE.test(handle)) return { ok: false, message: 'The web address can only use lowercase letters, numbers and dashes.' };
  const description = text(form, 'description'); if (description.length > 20000) return { ok: false, message: 'The description is too long.' };
  const taxClass = text(form, 'taxClass') as 'standard' | 'reduced' | 'zero'; if (!['standard', 'reduced', 'zero'].includes(taxClass)) return { ok: false, message: 'Choose a VAT rate.' };
  const status = text(form, 'status') === 'published' ? 'published' : 'draft';
  const { files, problems } = await readImages(form);
  const made = await run(() => gateway().addProduct({ title, priceMinor: price, sku: text(form, 'sku') || undefined, status, onHand: stock, description, compareAtMinor: compareAt ?? undefined, barcode: text(form, 'barcode') || undefined, weightGrams: weight ?? undefined, taxClass, seoTitle: text(form, 'seoTitle').slice(0, 120), seoDescription: text(form, 'seoDescription').slice(0, 320), handle: handle || undefined }), ['/products', '/inventory', '/']);
  if (!made.ok || !made.id || !files.length) return { ...made, message: problems.length ? `${made.message} ${problems.join('. ')}.` : made.message };
  const up = await run(() => gateway().uploadProductImages(made.id!, files), ['/products', `/products/${made.id}`]);
  return { ok: true, id: made.id, message: up.ok ? `${made.message} ${up.message}` : `${made.message} The product was saved, but the photos were not: ${up.message}` };
}
export async function saveProduct(id: string, e: ProductEdit) {
  if (e.title.trim().length > 120) return { ok: false, message: 'The name is over 120 characters.' };
  if (e.handle && !HANDLE.test(e.handle)) return { ok: false, message: 'The web address can only use lowercase letters, numbers and dashes.' };
  if (e.description.length > 20000 || e.seoTitle.length > 120 || e.seoDescription.length > 320) return { ok: false, message: 'One of the fields is too long.' };
  return run(() => gateway().updateProduct(id, e), ['/products', `/products/${id}`, '/']);
}
export async function removeProduct(id: string) { return run(() => gateway().deleteProduct(id), ['/products', '/inventory', '/']); }
export async function addProductImages(id: string, form: FormData) {
  const { files, problems } = await readImages(form); if (!files.length) return { ok: false, message: problems.join('. ') || 'No photos were added.' };
  const r = await run(() => gateway().uploadProductImages(id, files), ['/products', `/products/${id}`]); return problems.length && r.ok ? { ...r, message: `${r.message}. ${problems.join('. ')}.` } : r;
}
export async function saveProductImages(id: string, ordered: string[]) { return run(() => gateway().setProductImages(id, ordered), ['/products', `/products/${id}`]); }

// ---- Discounts ----
export async function saveDiscountAction(d: DiscountInput) { return run(() => gateway().saveDiscount(d), ['/discounts']); }
export async function setDiscountEnabledAction(id: string, enabled: boolean) { return run(() => gateway().setDiscountEnabled(id, enabled), ['/discounts']); }
export async function deleteDiscountAction(id: string) { return run(() => gateway().deleteDiscount(id), ['/discounts']); }
export async function discountProductsAction() { return gateway().discountProducts(); }

// ---- Collections ----
export async function saveCollectionAction(c: CollectionInput) { return run(() => gateway().saveCollection(c), ['/collections']); }
export async function deleteCollectionAction(id: string) { return run(() => gateway().deleteCollection(id), ['/collections']); }

// ---- Customers ----
export async function addCustomerNoteAction(id: string, text: string) { return run(() => gateway().addCustomerNote(id, text), [`/customers/${id}`]); }
export async function deleteCustomerNoteAction(id: string, noteId: string) { return run(() => gateway().deleteCustomerNote(id, noteId), [`/customers/${id}`]); }
export async function updateCustomerProfileAction(id: string, p: CustomerProfile) { return run(() => gateway().updateCustomerProfile(id, p), [`/customers/${id}`, '/customers']); }

// ---- Orders taken by hand ----
export async function orderFormDataAction() { const g = gateway(); const [items, shipping, customers] = await Promise.all([g.orderableItems(), g.shippingChoices(), g.customers()]); return { items, shipping, customers }; }
export async function createManualOrderAction(i: ManualOrderInput) { return run(() => gateway().createManualOrder(i), ['/orders', '/', '/inventory', '/customers']); }

// ---- Stock by item ----
const who = async () => { try { return (await gateway().viewer()).name; } catch { return undefined; } };
export async function adjustVariantStockAction(a: VariantStockAdjust) { const by = await who(); return run(() => gateway().adjustVariantStock({ ...a, by, note: a.note?.trim().slice(0, 200) || undefined }), ['/inventory', `/inventory/${a.variantId}`, '/products', '/']); }
export async function saveStockSettingsAction(id: string, s: StockSettings) { return run(() => gateway().saveStockSettings(id, s), ['/inventory', `/inventory/${id}`, '/products', '/']); }
export async function applyStockCountAction(lines: { variantId: string; counted: number }[], note?: string) {
  const by = await who(); try { const r = await gateway().applyStockCount(lines, by, note?.trim().slice(0, 200) || undefined); if (r.changed) ['/inventory', '/products', '/'].forEach(p => revalidatePath(p)); return r; } catch { return { ok: false, message: 'That did not go through. Nothing was changed.', changed: 0, unchanged: 0, problems: [] }; }
}

export async function exportCustomerAction(id: string) { return gateway().customerExport(id); }
export async function eraseCustomerAction(id: string) { return run(() => gateway().eraseCustomer(id), ['/customers', `/customers/${id}`, '/settings/activity']); }

export async function saveSegmentAction(i: { id?: string; name: string; definition: SegmentDefinition }) { return run(() => gateway().saveSegment(i), ['/customers', '/settings/activity']); }
export async function deleteSegmentAction(id: string) { return run(() => gateway().deleteSegment(id), ['/customers', '/settings/activity']); }

export async function moderateReviewAction(id: string, status: 'pending' | 'approved' | 'rejected') { return run(() => gateway().moderateReview(id, status), ['/reviews', '/settings/activity']); }
export async function replyToReviewAction(id: string, reply: string) { return run(() => gateway().replyToReview(id, reply), ['/reviews']); }
export async function deleteReviewAction(id: string) { return run(() => gateway().deleteReview(id), ['/reviews', '/settings/activity']); }

export async function saveMenuAction(key: string, items: { label: string; link: string }[], publish: boolean) { return run(() => gateway().saveMenu(key, items, publish), ['/content/menus', '/content']); }
export async function saveSitePageAction(page: { slug: string; title: string; body: string; seoDescription?: string }, publish: boolean, isNew: boolean) { return run(() => gateway().saveSitePage(page, publish, isNew), ['/content/pages', '/content']); }
export async function deleteSitePageAction(slug: string) { return run(() => gateway().deleteSitePage(slug), ['/content/pages', '/content']); }
