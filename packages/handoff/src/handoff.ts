import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { sniff, stripMetadata, mime, type ImageType } from './image.ts';

/** "Continue on your phone": the desktop shows a QR code; the phone opens it and sends photos straight into the product. The phone link carries NO
 *  login: it is a single-purpose, short-lived capability. It can only add images to one named target, from one device, until it expires or is closed.
 *  It cannot read anything, and it is useless for anything else. */
export type Role = 'owner' | 'admin' | 'staff' | 'support';
export interface Caller { storeId: string; userId: string; role: Role }
export type State = 'waiting' | 'connected' | 'completed' | 'cancelled' | 'expired';
export interface Target { kind: 'product_photos'; productId: string; label: string }
export interface Session { id: string; secretHash: string; storeId: string; userId: string; target: Target; maxFiles: number; createdAt: number; expiresAt: number; state: 'waiting' | 'connected' | 'completed' | 'cancelled'; deviceHash?: string; connectedAt?: number; files: { id: string; sha: string; type: ImageType; bytes: number; at: number }[] }
export interface SessionStore { get(id: string): Promise<Session | null>; put(s: Session): Promise<void>; countActive(userId: string, now: number): Promise<number> }
export interface PhotoStore { put(storeId: string, productId: string, fileId: string, bytes: Uint8Array, contentType: string): Promise<void> }

export const TTL_SECONDS = 600, MAX_FILE_BYTES = 12 * 1024 * 1024, MAX_FILES = 12, MAX_ACTIVE_PER_USER = 3;
export class HandoffError extends Error { constructor(readonly code: 'forbidden' | 'invalid' | 'expired' | 'device' | 'limit' | 'type' | 'size' | 'not_found', m: string) { super(m); } }
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createService(d: { store: SessionStore; photos: PhotoStore; now?: () => number; random?: (n: number) => Buffer }) {
  const now = () => (d.now ?? Date.now)(), rnd = d.random ?? randomBytes;
  const live = (s: Session) => s.expiresAt > now() && (s.state === 'waiting' || s.state === 'connected');
  const stateOf = (s: Session): State => (s.state === 'waiting' || s.state === 'connected') && s.expiresAt <= now() ? 'expired' : s.state;
  async function load(token: string) {
    const [id, secret] = token.split('.'); if (!id || !secret || !/^[\w-]{8,24}$/.test(id) || !/^[\w-]{40,64}$/.test(secret)) throw new HandoffError('not_found', 'This link is not valid.');
    const s = await d.store.get(id); if (!s || !safeEq(s.secretHash, sha(secret))) throw new HandoffError('not_found', 'This link is not valid.');       // same answer for unknown and wrong secret
    if (!live(s)) throw new HandoffError('expired', s.state === 'completed' || s.state === 'cancelled' ? 'This link has been closed.' : 'This link has expired. Make a new one on your computer.');
    return s;
  }
  const own = async (c: Caller, id: string) => { const s = await d.store.get(id); if (!s || s.storeId !== c.storeId || s.userId !== c.userId) throw new HandoffError('not_found', 'Not found.'); return s; };
  return {
    async create(c: Caller, target: Target, maxFiles = MAX_FILES) {
      if (c.role === 'support') throw new HandoffError('forbidden', 'Support access cannot add product photos.');
      if ((await d.store.countActive(c.userId, now())) >= MAX_ACTIVE_PER_USER) throw new HandoffError('limit', 'Close an open phone link before making another.');
      const id = rnd(9).toString('base64url'), secret = rnd(32).toString('base64url');
      await d.store.put({ id, secretHash: sha(secret), storeId: c.storeId, userId: c.userId, target, maxFiles: Math.min(maxFiles, MAX_FILES), createdAt: now(), expiresAt: now() + TTL_SECONDS * 1000, state: 'waiting', files: [] });
      return { id, token: `${id}.${secret}`, expiresAt: now() + TTL_SECONDS * 1000 };
    },
    /** Phone opens the link. The first device to open it owns it; a second device is refused, so a forwarded or photographed QR cannot take over. */
    async open(token: string, deviceKey: string) {
      const s = await load(token); const dh = sha(deviceKey);
      if (s.deviceHash && !safeEq(s.deviceHash, dh)) throw new HandoffError('device', 'This link is already in use on another phone.');
      if (!s.deviceHash) { s.deviceHash = dh; s.state = 'connected'; s.connectedAt = now(); await d.store.put(s); }
      return { label: s.target.label, remaining: s.maxFiles - s.files.length, expiresAt: s.expiresAt, received: s.files.length };
    },
    async upload(token: string, deviceKey: string, bytes: Uint8Array) {
      const s = await load(token); if (!s.deviceHash || !safeEq(s.deviceHash, sha(deviceKey))) throw new HandoffError('device', 'Open the link on this phone first.');
      if (s.files.length >= s.maxFiles) throw new HandoffError('limit', `You can add up to ${s.maxFiles} photos at a time.`);
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) throw new HandoffError('size', 'Photos must be under 12 MB.');
      const type = sniff(bytes); if (!type) throw new HandoffError('type', 'Only JPEG, PNG or WebP photos can be added.');
      let clean: Uint8Array; try { clean = stripMetadata(bytes, type); } catch { throw new HandoffError('invalid', 'That photo could not be read.'); }
      const digest = createHash('sha256').update(clean).digest('hex'); if (s.files.some(f => f.sha === digest)) return { duplicate: true as const, received: s.files.length };
      const fileId = rnd(9).toString('base64url'); await d.photos.put(s.storeId, s.target.productId, fileId, clean, mime(type));
      s.files.push({ id: fileId, sha: digest, type, bytes: clean.length, at: now() }); await d.store.put(s); return { duplicate: false as const, fileId, received: s.files.length };
    },
    /** Desktop polls this. Only the person who made the link, in the same store. */
    async status(c: Caller, id: string) { const s = await own(c, id); return { state: stateOf(s), files: s.files.map(f => ({ id: f.id, bytes: f.bytes })), expiresAt: s.expiresAt, maxFiles: s.maxFiles, label: s.target.label }; },
    async close(c: Caller, id: string, as: 'completed' | 'cancelled') { const s = await own(c, id); if (s.state === 'waiting' || s.state === 'connected') { s.state = as; await d.store.put(s); } return { state: s.state }; },
  };
}
export class MemSessions implements SessionStore {
  m = new Map<string, Session>();
  async get(id: string) { const s = this.m.get(id); return s ? structuredClone(s) : null; }
  async put(s: Session) { this.m.set(s.id, structuredClone(s)); }
  async countActive(userId: string, now: number) { return [...this.m.values()].filter(s => s.userId === userId && (s.state === 'waiting' || s.state === 'connected') && s.expiresAt > now).length; }
}
