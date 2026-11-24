import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

const Payload = z.object({ v: z.literal(1), storeId: z.string().min(1).max(200), email: z.string().email().max(320) }).strict();
const key = (hex: string) => { if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('UNSUBSCRIBE_SECRET must be 32 random bytes encoded as hex'); return Buffer.from(hex, 'hex'); };

export function createUnsubscribeToken(secret: string, storeId: string, email: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const plain = Buffer.from(JSON.stringify(Payload.parse({ v: 1, storeId, email: email.toLowerCase() })));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function parseUnsubscribeToken(secret: string, token: string): { storeId: string; email: string } | null {
  try {
    const raw = Buffer.from(token, 'base64url'); if (raw.length < 29 || raw.length > 1024) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(secret), raw.subarray(0, 12)); decipher.setAuthTag(raw.subarray(12, 28));
    const parsed = Payload.parse(JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()));
    return { storeId: parsed.storeId, email: parsed.email };
  } catch { return null; }
}
