import { NextResponse, type NextRequest } from 'next/server';

/** Demo-only: switch the fixture state. Disabled when a real gateway is configured. */
export function GET(req: NextRequest) {
  if (process.env.OSS_GATEWAY_URL) return new NextResponse('Not found', { status: 404 });
  const url = new URL(req.url);
  const st = url.searchParams.get('state');
  const back = url.searchParams.get('back') ?? '/';
  const safe = back.startsWith('/') && !back.startsWith('//') ? back : '/';
  const res = NextResponse.redirect(new URL(safe, req.url));
  if (st === 'new' || st === 'setup' || st === 'live') res.cookies.set('oss_demo', st, { path: '/', sameSite: 'lax', httpOnly: true });
  return res;
}
