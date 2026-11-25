'use server';
import { requestReset } from '@/lib/engine/public';
import { engineTarget } from '@/lib/session';

export type ForgotState = { error?: string; sent?: string };
/** Always the same answer for a known and an unknown address, so the form cannot be used to find out who has an account. */
export async function forgot(_p: ForgotState, f: FormData): Promise<ForgotState> {
  const email = String(f.get('email') ?? '').trim(); const t = engineTarget();
  if (!t) return { error: 'This is not available on this deployment.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter your email address.' };
  const r = await requestReset(t, email);
  if (!r.ok) return { error: r.message };
  return { sent: email };
}
