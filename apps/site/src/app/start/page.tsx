import type { Metadata } from 'next';
import { SignupFlow } from '@/components/SignupFlow';
export const metadata: Metadata = { title: 'Start your store', description: 'Tell us about your business and we will arrange a short call.' };
export default function Page() {
  return (<div className="su"><div className="wrap su-g"><div><p className="tag">Start your store</p><h1 className="d1" style={{ marginTop: 16, fontSize: 'clamp(38px,5.4vw,68px)' }}>Tell us about <span className="grad">your business.</span></h1><p className="lede" style={{ marginTop: 20 }}>Three short steps. We will arrange a call to talk it through. Nothing is built or billed until you have seen the design and the written scope.</p></div><SignupFlow /></div></div>);
}
