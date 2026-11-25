'use client';
import { useActionState } from 'react';
import { setPassword, type SetState } from './actions';
export function SetPasswordForm({ token, cta }: { token: string; cta: string }) {
  const [st, action, pending] = useActionState<SetState, FormData>(setPassword, {});
  return (<form action={action} className="fd" noValidate>
    <input type="hidden" name="t" value={token} />
    {st.error && <p className="ferr" role="alert">{st.error}</p>}
    <div className="field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" required autoFocus /><small className="muted">At least 10 characters.</small></div>
    <div className="field"><label htmlFor="again">New password again</label><input id="again" name="again" type="password" autoComplete="new-password" required /></div>
    <button className="btn primary" type="submit" disabled={pending} aria-busy={pending} style={{ justifyContent: 'center', height: 48 }}>{pending ? 'Saving…' : cta}</button>
  </form>);
}
