import type { Metadata } from 'next';
import { SignupFlow } from '@/components/SignupFlow';
export const metadata: Metadata = { title: 'Start your store', description: 'Tell us about your business and we will arrange a short call.' };
export default function Page() {
  return (<main className="su"><div className="wrap su-g"><div><p className="tag">Start your store</p><h1 className="d2" style={{ marginTop: 16 }}>Tell us about <span className="it" style={{ color: 'var(--green)' }}>your business.</span></h1><p className="lede" style={{ marginTop: 20 }}>Three short questions. We reply personally to arrange a call. Nothing is built or billed until you have seen the design and scope.</p></div><SignupFlow /></div></main>);
}
