'use client';
import { useActionState } from 'react';
import { signIn, type LoginState } from './actions';
export function LoginForm() {
  const [st, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (<form action={action} className="fd" noValidate>
    {st.error && <p className="ferr" role="alert">{st.error}</p>}
    <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus={!st.email} defaultValue={st.email ?? ''} key={st.email ?? 'e'} /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!st.email} /></div>
    <button className="btn primary" type="submit" disabled={pending} aria-busy={pending} style={{ justifyContent: 'center', height: 48 }}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>);
}
