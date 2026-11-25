'use client';
import { useActionState } from 'react';
import { forgot, type ForgotState } from './actions';
export function ForgotForm() {
  const [st, action, pending] = useActionState<ForgotState, FormData>(forgot, {});
  if (st.sent) return <p className="login-note" role="status">If <b>{st.sent}</b> has an account, we have sent a link to choose a new password. It works once and lasts an hour. Check your spam folder if it does not arrive.</p>;
  return (<form action={action} className="fd" noValidate>
    {st.error && <p className="ferr" role="alert">{st.error}</p>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus /></div>
    <button className="btn primary" type="submit" disabled={pending} aria-busy={pending} style={{ justifyContent: 'center', height: 48 }}>{pending ? 'Sending…' : 'Email me a link'}</button>
  </form>);
}
