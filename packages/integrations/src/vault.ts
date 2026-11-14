import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Provider credentials are encrypted with AES-256-GCM. The ciphertext is bound (as authenticated data) to the store and connection it
 *  belongs to, so a stolen or misrouted blob cannot be decrypted for another tenant. Keys are versioned so they can be rotated without
 *  re-asking merchants. In production the master keys come from a KMS; this module takes them as input and never logs them. */
export interface Keyring { current: string; keys: Record<string, Buffer> }
export class VaultError extends Error {}
export function seal(k: Keyring, plaintext: string, ctx: { storeId: string; connectionId: string }): string {
  const key = k.keys[k.current]; if (!key || key.length !== 32) throw new VaultError('Invalid encryption key');
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from(`${ctx.storeId}|${ctx.connectionId}`));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return ['v1', k.current, iv.toString('base64url'), ct.toString('base64url'), c.getAuthTag().toString('base64url')].join('.');
}
export function open(k: Keyring, blob: string, ctx: { storeId: string; connectionId: string }): string {
  const [v, kid, iv, ct, tag] = blob.split('.'); const key = k.keys[kid];
  if (v !== 'v1' || !key || !iv || !ct || !tag) throw new VaultError('Cannot decrypt credential');
  try { const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); d.setAAD(Buffer.from(`${ctx.storeId}|${ctx.connectionId}`)); d.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8'); }
  catch { throw new VaultError('Cannot decrypt credential'); }       // one message for tamper, wrong tenant and wrong key
}
/** Re-encrypt under the current key. Run over all rows after adding a new key; then retire the old one. */
export const rotate = (k: Keyring, blob: string, ctx: { storeId: string; connectionId: string }) => seal(k, open(k, blob, ctx), ctx);
