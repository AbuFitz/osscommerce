import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { createService, MemSessions, type Caller, type PhotoStore } from '@oss-commerce/handoff';
import { DEMO } from './env';

/** Demo storage: photos live in this server process. The live platform replaces `PhotoStore` with object storage (R2) behind the gateway; nothing else changes. */
class MemPhotos implements PhotoStore {
  files = new Map<string, { bytes: Uint8Array; type: string; product: string; at: number }>();
  async put(storeId: string, productId: string, fileId: string, bytes: Uint8Array, type: string) { this.files.set(`${storeId}/${productId}/${fileId}`, { bytes, type, product: productId, at: Date.now() }); }
  list(storeId: string, productId: string) { return [...this.files.entries()].filter(([k]) => k.startsWith(`${storeId}/${productId}/`)).sort((a, b) => a[1].at - b[1].at).map(([k, v]) => ({ id: k.split('/')[2], bytes: v.bytes.length })); }
  get(storeId: string, productId: string, fileId: string) { return this.files.get(`${storeId}/${productId}/${fileId}`); }
}
const g = globalThis as unknown as { __oss_handoff?: { photos: MemPhotos; svc: ReturnType<typeof createService> } };
function inst() { if (!g.__oss_handoff) { const photos = new MemPhotos(); g.__oss_handoff = { photos, svc: createService({ store: new MemSessions(), photos }) }; } return g.__oss_handoff; }
export const handoff = () => inst().svc;
export const photoStore = () => inst().photos;
export const AVAILABLE = DEMO;       // until the live platform provides storage and the real session, phone upload is a demo feature
/** The signed-in person. Demo: a fixed owner. Live: taken from the verified session, never from the request. */
export const callerNow = async (): Promise<Caller> => ({ storeId: 'demo_store', userId: 'demo_owner', role: 'owner' });

export async function origin() { const h = await headers(); const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100'; const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'); return `${proto}://${host}`; }
export const qrSvg = (text: string) => QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b2410', light: '#ffffff' } });
