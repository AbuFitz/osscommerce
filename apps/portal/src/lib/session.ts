import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { httpExec, EngineError, type EngineTarget } from './engine/exec';
import type { Exec } from './engine/catalogue';
import { isRecentAuthentication } from './control-plane-mapping';

export const SESSION_COOKIE = 'osc_session';
const REAUTH_COOKIE = 'osc_reauth_at';
/** The cell this deployment talks to. One store per deployment for now; routing by signed-in merchant through the control plane comes with multi-store. */
export function engineTarget(): EngineTarget | null { const url = process.env.ENGINE_ADMIN_URL; return url ? { url, channelToken: process.env.ENGINE_CHANNEL_TOKEN || undefined } : null; }
export const LIVE = !!process.env.ENGINE_ADMIN_URL;

export async function setSession(token: string) { const jar = await cookies(); const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 7 }; jar.set(SESSION_COOKIE, token, options); jar.set(REAUTH_COOKIE, String(Math.floor(Date.now() / 1000)), options); }
export async function clearSession() { const jar = await cookies(); jar.delete(SESSION_COOKIE); jar.delete(REAUTH_COOKIE); }
/** Payment onboarding changes the payout destination, so a week-old portal cookie is not enough. */
export async function recentlyAuthenticated(now = Date.now()): Promise<boolean> { return isRecentAuthentication(Number((await cookies()).get(REAUTH_COOKIE)?.value), now); }
/** An executor bound to the signed-in merchant. No session, or one the engine no longer accepts, sends them to sign in; nothing is ever served without it. */
export async function sessionExec(): Promise<Exec> {
  const t = engineTarget(); if (!t) throw new Error('ENGINE_ADMIN_URL is not set.');
  const token = (await cookies()).get(SESSION_COOKIE)?.value; if (!token) redirect('/login');
  const x = httpExec(t, token);
  return async (q, v) => { try { return await x(q, v); } catch (e) { if (e instanceof EngineError && e.code === 'FORBIDDEN') redirect('/login?expired=1'); throw e; } };
}
