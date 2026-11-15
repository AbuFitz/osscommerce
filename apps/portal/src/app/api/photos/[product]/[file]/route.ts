import { NextResponse } from 'next/server';
import { photoStore, callerNow, AVAILABLE } from '@/lib/handoff';
export const dynamic = 'force-dynamic';
/** Demo-only photo serving, scoped to the signed-in store. The live platform serves these from object storage. */
export async function GET(_: Request, { params }: { params: Promise<{ product: string; file: string }> }) {
  if (!AVAILABLE) return new NextResponse(null, { status: 404 });
  const { product, file } = await params; const f = photoStore().get((await callerNow()).storeId, product, file); if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(f.bytes), { headers: { 'content-type': f.type, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
}
