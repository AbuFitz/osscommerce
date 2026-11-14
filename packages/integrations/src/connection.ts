/** A tenant-scoped connection between one store and one provider in one environment. State comes from real checks, never from a click. */
export type State = 'available' | 'configuring' | 'pending' | 'connected' | 'degraded' | 'revoked' | 'disabled';
export interface Connection { id: string; storeId: string; providerId: string; env: 'test' | 'live'; state: State; externalAccountId?: string; credentialRef?: string; lastHealthAt?: number; lastSyncAt?: number; lastError?: { code: string; message: string; at: number }; failures: number }
export type Event = { type: 'begin' } | { type: 'authorised'; externalAccountId?: string; credentialRef: string } | { type: 'verified' } | { type: 'health_ok'; at: number } | { type: 'health_failed'; at: number; code: string; message: string }
  | { type: 'auth_revoked'; at: number } | { type: 'disable' } | { type: 'enable' } | { type: 'disconnect' } | { type: 'synced'; at: number };

export class IllegalTransition extends Error {}
const DEGRADE_AFTER = 3;        // consecutive failed health checks before a connection is shown as degraded: one blip is not an outage

export function newConnection(id: string, storeId: string, providerId: string, env: 'test' | 'live'): Connection { return { id, storeId, providerId, env, state: 'available', failures: 0 }; }
export function transition(c: Connection, e: Event): Connection {
  const bad = () => { throw new IllegalTransition(`${e.type} is not allowed while ${c.state}`); };
  switch (e.type) {
    case 'begin': if (c.state !== 'available' && c.state !== 'revoked') bad(); return { ...c, state: 'configuring', failures: 0, lastError: undefined };
    case 'authorised': if (c.state !== 'configuring') bad(); return { ...c, state: 'pending', credentialRef: e.credentialRef, externalAccountId: e.externalAccountId };
    case 'verified': if (c.state !== 'pending') bad(); return { ...c, state: 'connected', failures: 0, lastError: undefined };
    case 'health_ok': if (c.state === 'disabled' || c.state === 'revoked' || c.state === 'available') return c; return { ...c, state: c.state === 'degraded' ? 'connected' : c.state, failures: 0, lastHealthAt: e.at, lastError: c.state === 'degraded' ? undefined : c.lastError };
    case 'health_failed': { if (c.state === 'disabled' || c.state === 'revoked' || c.state === 'available') return c; const failures = c.failures + 1; return { ...c, failures, lastHealthAt: e.at, lastError: { code: e.code, message: e.message, at: e.at }, state: c.state === 'connected' && failures >= DEGRADE_AFTER ? 'degraded' : c.state }; }
    case 'auth_revoked': if (c.state === 'available') bad(); return { ...c, state: 'revoked', lastError: { code: 'auth_revoked', message: 'The provider no longer accepts this connection. Reconnect to continue.', at: e.at } };
    case 'disable': if (!['connected', 'degraded'].includes(c.state)) bad(); return { ...c, state: 'disabled' };
    case 'enable': if (c.state !== 'disabled') bad(); return { ...c, state: 'connected', failures: 0 };
    case 'disconnect': return { id: c.id, storeId: c.storeId, providerId: c.providerId, env: c.env, state: 'available', failures: 0 };          // credentials are removed by the caller; nothing sensitive is carried over
    case 'synced': if (c.state !== 'connected' && c.state !== 'degraded') return c; return { ...c, lastSyncAt: e.at };
  }
}
/** Features that depend on a connection stop working when it is not usable, and say why. */
export const usable = (c: Connection | undefined) => !!c && (c.state === 'connected' || c.state === 'degraded');
