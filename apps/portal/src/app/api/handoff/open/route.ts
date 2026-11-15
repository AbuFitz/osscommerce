import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { handoff, AVAILABLE } from '@/lib/handoff';
import { HandoffError } from '@oss-commerce/handoff';
export const dynamic = 'force-dynamic';

/** The phone opens its link. The first phone to do so is bound by a random device cookie (HttpOnly, scoped to this API). */
export async function POST(req: Request) {
  if (!AVAILABLE) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  const jar = req.headers.get('cookie') ?? ''; const existing = /(?:^|; )oss_hd=([\w-]+)/.exec(jar)?.[1]; const device = existing ?? randomBytes(24).toString('base64url');
  try {
    const info = await handoff().open(String(token ?? ''), device);
    const res = NextResponse.json(info, { headers: { 'cache-control': 'no-store' } });
    if (!existing) res.cookies.set('oss_hd', device, { httpOnly: true, sameSite: 'lax', secure: req.url.startsWith('https:'), path: '/api/handoff', maxAge: 900 });
    return res;
  } catch (e) { const he = e instanceof HandoffError ? e : null; return NextResponse.json({ error: he?.message ?? 'Something went wrong.', code: he?.code ?? 'invalid' }, { status: he ? (he.code === 'device' ? 409 : he.code === 'expired' ? 410 : 404) : 500, headers: { 'cache-control': 'no-store' } }); }
}
