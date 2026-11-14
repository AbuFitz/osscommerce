import type { Connection } from './connection.ts';
import { transition } from './connection.ts';
import type { Manifest } from './manifest.ts';

export interface HealthResult { ok: boolean; code?: string; message?: string }
export interface SyncResult { cursor?: string; changed: number }
/** What a provider adapter must implement. Adapters never touch the commerce engine directly: they receive plain data, return plain data,
 *  and are run by the platform's durable job queue with the connection's decrypted credentials passed in for the duration of one call. */
export interface ProviderAdapter {
  manifest: Manifest;
  validate(creds: Record<string, string>): Promise<{ ok: boolean; externalAccountId?: string; message?: string }>;
  health(c: Connection, creds: Record<string, string>): Promise<HealthResult>;
  sync?(c: Connection, creds: Record<string, string>, cursor?: string): Promise<SyncResult>;
  handleEvent?(c: Connection, event: unknown): Promise<void>;
}

/** Error text from providers can echo credentials or personal data. Strip anything key-shaped before it is stored or shown to anyone. */
export function redact(message: string, secrets: string[] = []): string {
  let m = message; for (const s of secrets) if (s.length >= 6) m = m.split(s).join('[redacted]');
  return m.replace(/\b(sk|rk|pk|whsec|vcp|ghp|xox[a-z])_[A-Za-z0-9_]{6,}/g, '[redacted]').replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').slice(0, 300);
}

/** SSRF guard: adapters may only call https hosts listed in their manifest, and never an address that resolves into a private range. */
export function assertAllowedUrl(m: Manifest, url: string) {
  let u: URL; try { u = new URL(url); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'https:') throw new Error('Only https is allowed');
  if (u.username || u.password) throw new Error('Credentials in URLs are not allowed');
  if (!m.allowedHosts.includes(u.hostname)) throw new Error(`Host not allowed for ${m.id}`);
  if (/^(localhost|.*\.internal|.*\.local)$/i.test(u.hostname) || /^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) || u.hostname.startsWith('[')) throw new Error('Address not allowed');
}

export interface HealthDeps { adapter: ProviderAdapter; load(c: Connection): Promise<Record<string, string>>; now(): number; limit(key: string): boolean; save(c: Connection): Promise<void>; audit(e: { storeId: string; connectionId: string; action: string; detail?: string }): Promise<void> }
/** One health check. Respects the provider rate limit, redacts errors, and moves the connection through its state machine. */
export async function runHealth(d: HealthDeps, c: Connection): Promise<Connection> {
  if (!d.limit(`${c.providerId}:${c.storeId}`)) return c;                 // skip, do not fail: being rate limited by ourselves is not the provider's fault
  const creds = await d.load(c); let next: Connection;
  try { const r = await d.adapter.health(c, creds); next = r.ok ? transition(c, { type: 'health_ok', at: d.now() }) : transition(c, { type: 'health_failed', at: d.now(), code: r.code ?? 'unhealthy', message: redact(r.message ?? 'Health check failed', Object.values(creds)) }); }
  catch (e) { const code = /401|403|unauthor/i.test(String((e as Error).message)) ? 'auth' : 'error'; next = code === 'auth' ? transition(c, { type: 'auth_revoked', at: d.now() }) : transition(c, { type: 'health_failed', at: d.now(), code, message: redact((e as Error).message, Object.values(creds)) }); }
  if (next.state !== c.state) await d.audit({ storeId: c.storeId, connectionId: c.id, action: `integration.${c.state}_to_${next.state}` });
  await d.save(next); return next;
}
