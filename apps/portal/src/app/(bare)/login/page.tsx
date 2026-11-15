import { redirect } from 'next/navigation';
import { LIVE } from '@/lib/session';
import { LoginForm } from './LoginForm';
export const metadata = { title: 'Sign in' };
export default async function Login({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (!LIVE) redirect('/'); const { expired } = await searchParams;
  return (<main className="login"><div className="login-card">
    <p className="login-wm" aria-label="OneSimpleCommerce">one<b>simple</b>commerce<em>.</em></p>
    <h1>Sign in to your store</h1>
    {expired && <p className="login-note" role="status">You were signed out. Sign in again to carry on.</p>}
    <LoginForm />
    <p className="login-fine">Trouble signing in? Message the team who set up your store.</p>
  </div></main>);
}
