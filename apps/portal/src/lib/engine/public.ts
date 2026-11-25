import 'server-only';
import type { EngineTarget } from './exec';

/**
 * Calls the engine with no sign-in, for the two things a person does before they have a session: set a password from an emailed link, and ask for a reset link.
 * The engine decides who it is for from the store's channel token alone, and answers every failure the same way, so nothing here can be used to learn who has an account.
 */
async function call(t: EngineTarget, query: string, variables: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string; unreachable?: boolean }> {
  let res: Response;
  try { res = await fetch(t.url, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', ...(t.channelToken ? { 'vendure-token': t.channelToken } : {}) }, body: JSON.stringify({ query, variables }) }); }
  catch { return { ok: false, message: 'We could not reach your store just now. Try again in a moment.', unreachable: true }; }
  const body = await res.json().catch(() => null) as { errors?: { message: string }[] } | null;
  if (body?.errors?.length) return { ok: false, message: body.errors[0].message };
  return res.ok && body ? { ok: true } : { ok: false, message: 'That did not go through. Try again.' };
}
export const acceptLink = (t: EngineTarget, token: string, password: string) => call(t, 'mutation($t:String!,$p:String!){ acceptStaffToken(token:$t,password:$p) }', { t: token, p: password });
export const requestReset = (t: EngineTarget, email: string) => call(t, 'mutation($e:String!){ requestStaffPasswordReset(email:$e) }', { e: email });
