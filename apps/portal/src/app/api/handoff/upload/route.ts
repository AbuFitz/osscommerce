import { NextResponse } from 'next/server';
import { handoff, AVAILABLE } from '@/lib/handoff';
import { HandoffError, MAX_FILE_BYTES } from '@oss-commerce/handoff';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!AVAILABLE) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  const len = Number(req.headers.get('content-length') ?? 0); if (len > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: 'Photos must be under 12 MB.', code: 'size' }, { status: 413 });
  const device = /(?:^|; )oss_hd=([\w-]+)/.exec(req.headers.get('cookie') ?? '')?.[1] ?? '';
  const form = await req.formData().catch(() => null); const file = form?.get('file'); const token = String(form?.get('token') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received.', code: 'invalid' }, { status: 400 });
  try { return NextResponse.json(await handoff().upload(token, device, new Uint8Array(await file.arrayBuffer())), { headers: { 'cache-control': 'no-store' } }); }
  catch (e) { const he = e instanceof HandoffError ? e : null; return NextResponse.json({ error: he?.message ?? 'Something went wrong.', code: he?.code ?? 'invalid' }, { status: he ? (he.code === 'limit' ? 409 : he.code === 'size' ? 413 : he.code === 'device' ? 403 : he.code === 'expired' ? 410 : 400) : 500 }); }
}
