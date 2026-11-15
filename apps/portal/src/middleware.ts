import { NextResponse, type NextRequest } from 'next/server';
/** Demo only: give each browser its own scratch copy of the demo data, so what one reviewer changes does not appear for another. */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.NEXT_PUBLIC_OSS_DEMO === '1' && !req.cookies.get('oss_sid')) res.cookies.set('oss_sid', crypto.randomUUID(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
export const config = { matcher: ['/((?!_next/|api/|favicon|icon).*)'] };
