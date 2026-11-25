import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LIVE } from '@/lib/session';
import { SetPasswordForm } from './SetPasswordForm';
export const metadata = { title: 'Choose a password', robots: { index: false } };
export default async function SetPassword({ searchParams }: { searchParams: Promise<{ t?: string; k?: string }> }) {
  if (!LIVE) redirect('/'); const { t = '', k } = await searchParams; const invite = k === 'invite';
  return (<main className="login"><div className="login-card">
    <p className="login-wm" aria-label="OneSimpleCommerce">one<b>simple</b>commerce<em>.</em></p>
    <h1>{invite ? 'Welcome. Choose a password' : 'Choose a new password'}</h1>
    <p className="login-note">{invite ? 'This finishes setting up your account. You will use this password to sign in.' : 'Your old password stops working as soon as you save.'}</p>
    <SetPasswordForm token={t} cta={invite ? 'Create my account' : 'Save password'} />
    <p className="login-fine">Link not working? <Link href="/forgot-password">Ask for a new one</Link>.</p>
  </div></main>);
}
