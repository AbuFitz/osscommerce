'use server';
import { redirect } from 'next/navigation';
import { engineLogin, EngineError } from '@/lib/engine/exec';
import { engineTarget, setSession, clearSession } from '@/lib/session';

export type LoginState = { error?: string; email?: string };
export async function signIn(_p: LoginState, f: FormData): Promise<LoginState> {
  const email = String(f.get('email') ?? '').trim(); const password = String(f.get('password') ?? ''); const t = engineTarget();
  if (!t) return { error: 'Sign-in is not available on this deployment.' };
  if (!/^\S+@\S+\.\S+$/.test(email) || !password) return { error: 'Enter your email address and password.', email };
  let s: Awaited<ReturnType<typeof engineLogin>>;
  try { s = await engineLogin(t, email, password); } catch (e) { return { error: e instanceof EngineError && e.code === 'UNREACHABLE' ? 'We could not reach your store just now. Try again in a moment.' : 'Sign-in failed. Try again.', email }; }
  if (!s) return { error: 'That email and password do not match. Check them and try again.', email };
  await setSession(s.token); redirect('/');
}
export async function signOut() { await clearSession(); redirect('/login'); }
