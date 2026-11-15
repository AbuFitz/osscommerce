import { NextResponse, type NextRequest } from 'next/server';
/**
 * Live: every page except sign-in needs a session cookie (the engine still checks the session on every call; this only avoids rendering for nobody).
 * Demo: give each browser its own scratch copy of the demo data.
 */
export function middleware(req: NextRequest) {
  if (process.env.ENGINE_ADMIN_URL) {
    const open = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/h/');
    if (!open && !req.cookies.get('osc_session')) return NextResponse.redirect(new URL('/login', req.url));
    return NextResponse.next();
  }
  const res = NextResponse.next();
  if (process.env.NEXT_PUBLIC_OSS_DEMO === '1' && !req.cookies.get('oss_sid')) res.cookies.set('oss_sid', crypto.randomUUID(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
export const config = { matcher: ['/((?!_next/|api/|favicon|icon|brands/).*)'] };
