import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LIVE } from '@/lib/session';
import { ForgotForm } from './ForgotForm';
export const metadata = { title: 'Reset your password', robots: { index: false } };
export default function Forgot() {
  if (!LIVE) redirect('/');
  return (<main className="login"><div className="login-card">
    <p className="login-wm" aria-label="OneSimpleCommerce">one<b>simple</b>commerce<em>.</em></p>
    <h1>Reset your password</h1>
    <ForgotForm />
    <p className="login-fine"><Link href="/login">Back to sign in</Link></p>
  </div></main>);
}
