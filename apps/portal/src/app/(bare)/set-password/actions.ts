'use server';
import { redirect } from 'next/navigation';
import { acceptLink } from '@/lib/engine/public';
import { engineTarget } from '@/lib/session';

export type SetState = { error?: string };
/** The link is the proof of the inbox. On success the person signs in with the password they just chose. */
export async function setPassword(_p: SetState, f: FormData): Promise<SetState> {
  const token = String(f.get('t') ?? ''); const next = String(f.get('password') ?? ''); const again = String(f.get('again') ?? ''); const t = engineTarget();
  if (!t) return { error: 'This is not available on this deployment.' };
  if (!token) return { error: 'This link is incomplete. Open it again from your email.' };
  if (next.length < 10) return { error: 'Use at least 10 characters.' };
  if (next !== again) return { error: 'The two passwords are different.' };
  const r = await acceptLink(t, token, next);
  if (!r.ok) return { error: r.message };
  redirect('/login?ready=1');
}
