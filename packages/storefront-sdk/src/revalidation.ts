import { z } from 'zod';
import { verify } from './signing.ts';
import { parseTag } from './tags.ts';

const Body = z.object({ eventId: z.string().min(8).max(80), storeId: z.string(), storefrontId: z.string(), sequence: z.number().int().nonnegative(), tags: z.array(z.string()).min(1).max(100) });
export interface RevalidationDeps { secret: string; storeId: string; storefrontId: string; revalidate(tag: string): void; seen: { markIfNew(eventId: string): boolean | Promise<boolean>; lastSequence(): number | Promise<number>; setSequence(n: number): void | Promise<void> } }

/** Framework-neutral handler: Next route files call this with the raw body and header. Order of checks matters:
 *  signature first (nothing is parsed from an unauthenticated body), then identity, then duplicate/ordering, then tags. */
export async function handleRevalidation(d: RevalidationDeps, rawBody: string, sigHeader: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!verify(d.secret, rawBody, sigHeader).ok) return { status: 401, body: { error: 'unauthorized' } };
  let parsed; try { parsed = Body.parse(JSON.parse(rawBody)); } catch { return { status: 400, body: { error: 'invalid body' } }; }
  if (parsed.storeId !== d.storeId || parsed.storefrontId !== d.storefrontId) return { status: 403, body: { error: 'wrong storefront' } };
  if (!(await d.seen.markIfNew(parsed.eventId))) return { status: 200, body: { duplicate: true } };
  const last = await d.seen.lastSequence();
  if (parsed.sequence < last) return { status: 200, body: { stale: true } };      // an older event arriving late: a newer one has already refreshed these tags
  const done: string[] = [], rejected: string[] = [];
  for (const t of parsed.tags) { const p = parseTag(t); if (!p || p.storeId !== d.storeId) { rejected.push(t); continue; } d.revalidate(t); done.push(t); }
  await d.seen.setSequence(parsed.sequence);
  return { status: rejected.length ? 207 : 200, body: { revalidated: done, rejected } };
}

/** Platform side: which tags a merchant action affects. Scoped to one store; a product change never touches collections of anyone else,
 *  and private data (carts, orders, customers) never produces a tag. Price and stock changes also refresh search. */
export type Change = { type: 'product.updated' | 'product.deleted' | 'product.unpublished'; productId: string; collectionIds?: string[] } | { type: 'collection.updated'; collectionId: string } | { type: 'content.published'; entry: string } | { type: 'navigation.updated' } | { type: 'channel.updated' };
import { tag } from './tags.ts';
export function tagsFor(storeId: string, c: Change): string[] {
  switch (c.type) {
    case 'product.updated': case 'product.deleted': case 'product.unpublished':
      return [tag(storeId, 'product', c.productId), tag(storeId, 'search'), ...(c.collectionIds ?? []).map(id => tag(storeId, 'collection', id)), tag(storeId, 'collections')];
    case 'collection.updated': return [tag(storeId, 'collection', c.collectionId), tag(storeId, 'collections'), tag(storeId, 'navigation')];
    case 'content.published': return [tag(storeId, 'content', c.entry)];
    case 'navigation.updated': return [tag(storeId, 'navigation')];
    case 'channel.updated': return [tag(storeId, 'channel')];
  }
}
import { sign } from './signing.ts';
export function buildRevalidationRequest(secret: string, e: { eventId: string; storeId: string; storefrontId: string; sequence: number; tags: string[] }, now?: number) {
  const body = JSON.stringify(e); return { body, headers: { 'content-type': 'application/json', 'oss-signature': sign(secret, body, now) } };
}
