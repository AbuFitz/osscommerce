import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { httpExec, EngineError, type EngineTarget } from './engine/exec';
import type { Exec } from './engine/catalogue';

export const SESSION_COOKIE = 'osc_session';
/** The cell this deployment talks to. One store per deployment for now; routing by signed-in merchant through the control plane comes with multi-store. */
export function engineTarget(): EngineTarget | null { const url = process.env.ENGINE_ADMIN_URL; return url ? { url, channelToken: process.env.ENGINE_CHANNEL_TOKEN || undefined } : null; }
export const LIVE = !!process.env.ENGINE_ADMIN_URL;

export async function setSession(token: string) { (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 }); }
export async function clearSession() { (await cookies()).delete(SESSION_COOKIE); }
/** An executor bound to the signed-in merchant. No session, or one the engine no longer accepts, sends them to sign in; nothing is ever served without it. */
export async function sessionExec(): Promise<Exec> {
  const t = engineTarget(); if (!t) throw new Error('ENGINE_ADMIN_URL is not set.');
  const token = (await cookies()).get(SESSION_COOKIE)?.value; if (!token) redirect('/login');
  const x = httpExec(t, token);
  return async (q, v) => { try { return await x(q, v); } catch (e) { if (e instanceof EngineError && e.code === 'FORBIDDEN') redirect('/login?expired=1'); throw e; } };
}
