/** Cache tags are always qualified by store and storefront, so one merchant's invalidation can never touch another's cache,
 *  even if two storefronts were ever served from one deployment. Only public catalogue/content data is taggable. */
export type TagKind = 'product' | 'collection' | 'collections' | 'content' | 'navigation' | 'channel' | 'search';
const SAFE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export function tag(storeId: string, kind: TagKind, id?: string): string {
  if (!SAFE.test(storeId) || (id !== undefined && !SAFE.test(id))) throw new Error('Unsafe cache tag segment');
  return id === undefined ? `${storeId}:${kind}` : `${storeId}:${kind}:${id}`;
}
/** Private shopper data has no tag on purpose: it must never be cached, so it can never be revalidated into a shared cache. */
export const PRIVATE_NEVER_CACHE = ['cart', 'order', 'customer', 'session', 'checkout'] as const;
export function parseTag(t: string): { storeId: string; kind: TagKind; id?: string } | null {
  const [storeId, kind, id, extra] = t.split(':');
  if (extra !== undefined || !storeId || !SAFE.test(storeId) || !['product','collection','collections','content','navigation','channel','search'].includes(kind) || (id !== undefined && !SAFE.test(id))) return null;
  return { storeId, kind: kind as TagKind, id };
}
