import type { StorefrontConfig } from './config.ts';
import { OssApiError, fromStatus } from './errors.ts';

export const SDK_VERSION = '0.1.0';
export const SUPPORTED_API = 'v1';

export interface RequestEvent { operation: string; attempt: number; ms: number; status?: number; requestId?: string; outcome: 'ok' | 'error' | 'retry'; code?: string }
export interface ClientOptions { timeoutMs?: number; maxRetries?: number; fetch?: typeof fetch; onEvent?: (e: RequestEvent) => void; sleep?: (ms: number) => Promise<void> }
/** The shopper's own address and browser, as seen by your storefront server. Used only to count a visit once per day without cookies, and to slow review spam. Never stored. */
export interface ShopperHints { ip?: string; agent?: string }
export interface CallOptions { shopper?: ShopperHints; session?: string; idempotencyKey?: string; signal?: AbortSignal; mutation?: boolean; language?: string; currency?: string }
export interface Result<T> { data: T; session?: string; requestId?: string }
export interface PublishedContent<T> { entry: string; revision: number; schemaVersion: number; body: T; publishedAt: string }
export interface StorefrontPreferences { configVersion: number; guestCheckout: boolean; askMarketingConsent: boolean; showSoldOut: boolean; checkoutPaused: boolean }

/** Server-side client for the OSS gateway. Used from Next server components, route handlers and server actions only:
 *  the server secret is a header here and must never reach a browser. The storefront is identified by that secret; there is no
 *  channel-token header at all, because the gateway derives the channel from the verified credential. */
export function createClient(cfg: StorefrontConfig, o: ClientOptions = {}) {
  const f = o.fetch ?? fetch, timeout = o.timeoutMs ?? 8000, maxRetries = o.maxRetries ?? 2, sleep = o.sleep ?? ((ms: number) => new Promise(r => setTimeout(r, ms)));
  async function call<T>(operation: string, query: string, variables: Record<string, unknown>, c: CallOptions = {}): Promise<Result<T>> {
    const mutation = c.mutation ?? /^\s*mutation\b/.test(query);
    // A mutation is retried only when the caller supplied an idempotency key the gateway can de-duplicate on. Reads are always safe.
    const retryable = !mutation || !!c.idempotencyKey;
    for (let attempt = 0; ; attempt++) {
      const started = Date.now(); const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeout);
      c.signal?.addEventListener('abort', () => ac.abort(), { once: true });
      try {
        const res = await f(`${cfg.apiUrl}/v1/shop`, {
          method: 'POST', signal: ac.signal, cache: 'no-store',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.serverSecret}`, 'oss-storefront': cfg.storefrontId, 'oss-sdk': SDK_VERSION, 'oss-api': SUPPORTED_API, 'oss-operation': operation,
            ...(c.session ? { 'oss-session': c.session } : {}), ...(c.shopper?.ip ? { 'oss-client-ip': c.shopper.ip } : {}), ...(c.shopper?.agent ? { 'oss-client-agent': c.shopper.agent.replace(/[^\x20-\x7e]/g, '').slice(0, 300) } : {}), ...(c.idempotencyKey ? { 'idempotency-key': c.idempotencyKey } : {}), ...(c.language ? { 'oss-language': c.language } : {}), ...(c.currency ? { 'oss-currency': c.currency } : {}) },
          body: JSON.stringify({ query, variables }),
        });
        const requestId = res.headers.get('oss-request-id') ?? undefined;
        if (!res.ok) throw fromStatus(res.status, requestId);
        const json = await res.json() as { data?: T; errors?: { message: string }[] };
        if (json.errors?.length) throw new OssApiError(json.errors.map(e => e.message).join('; '), 'graphql', 200, requestId);
        if (!json.data) throw new OssApiError('Empty response.', 'server', 200, requestId, true);
        o.onEvent?.({ operation, attempt, ms: Date.now() - started, status: res.status, requestId, outcome: 'ok' });
        return { data: json.data, session: res.headers.get('oss-session') ?? undefined, requestId };
      } catch (e) {
        const err = e instanceof OssApiError ? e : (ac.signal.aborted && !c.signal?.aborted) ? new OssApiError('The commerce API timed out.', 'timeout', undefined, undefined, true) : new OssApiError('Could not reach the commerce API.', 'network', undefined, undefined, true);
        const again = err.retryable && retryable && attempt < maxRetries;
        o.onEvent?.({ operation, attempt, ms: Date.now() - started, status: err.status, requestId: err.requestId, outcome: again ? 'retry' : 'error', code: err.code });
        if (!again) throw err;
        await sleep(Math.min(2000, 200 * 2 ** attempt) * (0.5 + Math.random() / 2));
      } finally { clearTimeout(timer); }
    }
  }
  async function content<T>(entry: string, options: { signal?: AbortSignal; revalidateSeconds?: number } = {}): Promise<PublishedContent<T> | null> {
    if (!/^[a-z0-9][a-z0-9:/_-]{0,119}$/.test(entry)) throw new OssApiError('Invalid content entry.', 'invalid_request', 400);
    for (let attempt = 0; ; attempt++) {
      const started = Date.now(); const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeout); options.signal?.addEventListener('abort', () => ac.abort(), { once: true });
      try {
        const res = await f(`${cfg.apiUrl}/v1/content/${encodeURIComponent(entry)}`, {
          method: 'GET', signal: ac.signal, headers: { authorization: `Bearer ${cfg.serverSecret}`, 'oss-storefront': cfg.storefrontId, 'oss-sdk': SDK_VERSION, 'oss-api': SUPPORTED_API },
          ...(options.revalidateSeconds === 0 ? { cache: 'no-store' as const } : { next: { revalidate: options.revalidateSeconds ?? 60 } } as any),
        });
        const requestId = res.headers.get('oss-request-id') ?? undefined; if (res.status === 404) return null; if (!res.ok) throw fromStatus(res.status, requestId);
        const json = await res.json() as any;
        if (!json || json.entry !== entry || !Number.isInteger(json.revision) || !Number.isInteger(json.schemaVersion) || typeof json.publishedAt !== 'string' || !('body' in json)) throw new OssApiError('Invalid content response.', 'server', 200, requestId, true);
        o.onEvent?.({ operation: `content:${entry}`, attempt, ms: Date.now() - started, status: res.status, requestId, outcome: 'ok' }); return json as PublishedContent<T>;
      } catch (e) {
        const err = e instanceof OssApiError ? e : ac.signal.aborted && !options.signal?.aborted ? new OssApiError('The commerce API timed out.', 'timeout', undefined, undefined, true) : new OssApiError('Could not reach the commerce API.', 'network', undefined, undefined, true);
        const again = err.retryable && attempt < maxRetries; o.onEvent?.({ operation: `content:${entry}`, attempt, ms: Date.now() - started, status: err.status, requestId: err.requestId, outcome: again ? 'retry' : 'error', code: err.code }); if (!again) throw err; await sleep(Math.min(2000, 200 * 2 ** attempt) * (0.5 + Math.random() / 2));
      } finally { clearTimeout(timer); }
    }
  }
  async function preferences(options: { signal?: AbortSignal; revalidateSeconds?: number } = {}): Promise<StorefrontPreferences> {
    for (let attempt = 0; ; attempt++) {
      const started = Date.now(); const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeout); options.signal?.addEventListener('abort', () => ac.abort(), { once: true });
      try {
        const res = await f(`${cfg.apiUrl}/v1/preferences`, {
          method: 'GET', signal: ac.signal, headers: { authorization: `Bearer ${cfg.serverSecret}`, 'oss-storefront': cfg.storefrontId, 'oss-sdk': SDK_VERSION, 'oss-api': SUPPORTED_API },
          ...(options.revalidateSeconds === 0 ? { cache: 'no-store' as const } : { next: { revalidate: options.revalidateSeconds ?? 60 } } as any),
        });
        const requestId = res.headers.get('oss-request-id') ?? undefined; if (!res.ok) throw fromStatus(res.status, requestId);
        const json = await res.json() as Partial<StorefrontPreferences>;
        const keys = ['configVersion','guestCheckout','askMarketingConsent','showSoldOut','checkoutPaused'];
        if (Object.keys(json).length !== keys.length || !Number.isInteger(json.configVersion) || !keys.slice(1).every(k => typeof (json as any)[k] === 'boolean')) throw new OssApiError('Invalid preferences response.', 'server', 200, requestId, true);
        o.onEvent?.({ operation: 'preferences', attempt, ms: Date.now() - started, status: res.status, requestId, outcome: 'ok' }); return json as StorefrontPreferences;
      } catch (e) {
        const err = e instanceof OssApiError ? e : ac.signal.aborted && !options.signal?.aborted ? new OssApiError('The commerce API timed out.', 'timeout', undefined, undefined, true) : new OssApiError('Could not reach the commerce API.', 'network', undefined, undefined, true);
        const again = err.retryable && attempt < maxRetries; o.onEvent?.({ operation: 'preferences', attempt, ms: Date.now() - started, status: err.status, requestId: err.requestId, outcome: again ? 'retry' : 'error', code: err.code }); if (!again) throw err; await sleep(Math.min(2000, 200 * 2 ** attempt) * (0.5 + Math.random() / 2));
      } finally { clearTimeout(timer); }
    }
  }
  /** Counts a visit, without cookies. Call from the server (a route handler or middleware) with the shopper's own address and browser. Never throws: a failed count must not break a page. */
  async function trackVisit(v: { kind: 'page' | 'product' | 'cart' | 'checkout' | 'purchase'; path: string; referrer?: string; width?: number }, shopper: ShopperHints): Promise<boolean> {
    try { await call('trackVisit', 'mutation($i: VisitInput!){ trackVisit(input: $i) }', { i: v }, { shopper, mutation: true }); return true; } catch { return false; }
  }
  /** Approved reviews and the average rating for a product. Plain text: render it as text, never as HTML. */
  async function productReviews(productId: string, page: { take?: number; skip?: number } = {}) {
    return (await call<{ productReviews: { summary: { count: number; average: number }; items: { id: number; rating: number; title: string; body: string; authorName: string; verified: boolean; reply: string | null; at: string }[]; hasMore: boolean } }>('productReviews', 'query($p: ID!, $t: Int, $s: Int){ productReviews(productId: $p, take: $t, skip: $s){ summary{ count average } items{ id rating title body authorName verified reply at } hasMore } }', { p: productId, t: page.take ?? 10, s: page.skip ?? 0 }, { mutation: false })).data.productReviews;
  }
  /** Sends a review for the merchant to approve. Pass the shopper's own address so one person cannot flood a store. */
  async function submitReview(r: { productId: string; rating: number; title: string; body: string; name: string; email: string }, shopper: ShopperHints) {
    await call('submitReview', 'mutation($i: ReviewInput!){ submitReview(input: $i) }', { i: r }, { shopper, mutation: true }); return true;
  }
  return { trackVisit, productReviews, submitReview, call, query: <T>(op: string, q: string, v: Record<string, unknown> = {}, c: CallOptions = {}) => call<T>(op, q, v, { ...c, mutation: false }), mutate: <T>(op: string, q: string, v: Record<string, unknown>, c: CallOptions = {}) => call<T>(op, q, v, { ...c, mutation: true }), content, preferences };
}

/** Compatibility handshake. Run at boot and in CI: the API states which SDK majors it supports. */
export function checkCompatibility(meta: { apiVersion: string; minSdk: string; maxSdk?: string }, sdk = SDK_VERSION): { ok: boolean; reason?: string } {
  const n = (v: string) => v.split('.').map(Number);
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0); return 0; };
  if (meta.apiVersion !== SUPPORTED_API) return { ok: false, reason: `API ${meta.apiVersion} is not supported by this SDK (expects ${SUPPORTED_API}).` };
  if (cmp(n(sdk), n(meta.minSdk)) < 0) return { ok: false, reason: `SDK ${sdk} is older than the minimum ${meta.minSdk}. Upgrade the SDK.` };
  if (meta.maxSdk && cmp(n(sdk), n(meta.maxSdk)) > 0) return { ok: false, reason: `SDK ${sdk} is newer than the API supports (${meta.maxSdk}).` };
  return { ok: true };
}
