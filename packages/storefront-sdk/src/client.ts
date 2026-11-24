import type { StorefrontConfig } from './config.ts';
import { OssApiError, fromStatus } from './errors.ts';

export const SDK_VERSION = '0.1.0';
export const SUPPORTED_API = 'v1';

export interface RequestEvent { operation: string; attempt: number; ms: number; status?: number; requestId?: string; outcome: 'ok' | 'error' | 'retry'; code?: string }
export interface ClientOptions { timeoutMs?: number; maxRetries?: number; fetch?: typeof fetch; onEvent?: (e: RequestEvent) => void; sleep?: (ms: number) => Promise<void> }
export interface CallOptions { session?: string; idempotencyKey?: string; signal?: AbortSignal; mutation?: boolean; language?: string; currency?: string }
export interface Result<T> { data: T; session?: string; requestId?: string }
export interface PublishedContent<T> { entry: string; revision: number; schemaVersion: number; body: T; publishedAt: string }

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
            ...(c.session ? { 'oss-session': c.session } : {}), ...(c.idempotencyKey ? { 'idempotency-key': c.idempotencyKey } : {}), ...(c.language ? { 'oss-language': c.language } : {}), ...(c.currency ? { 'oss-currency': c.currency } : {}) },
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
  return { call, query: <T>(op: string, q: string, v: Record<string, unknown> = {}, c: CallOptions = {}) => call<T>(op, q, v, { ...c, mutation: false }), mutate: <T>(op: string, q: string, v: Record<string, unknown>, c: CallOptions = {}) => call<T>(op, q, v, { ...c, mutation: true }), content };
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
