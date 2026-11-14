import { Header } from '@/components/ui';
const NAMES: Record<string, string> = { website: 'Website', billing: 'Billing', support: 'Support' };
export default async function Account({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const name = NAMES[slug] ?? 'Account';
  return (<><Header title={name} /><div className="w flat"><p style={{ marginTop: 0 }}>{name} is managed in your OSS account. This is the same login, so you will not be asked to sign in again.</p><span className="muted" style={{ fontSize: 12 }}>Integration point: OSS Manage. Not connected in this build.</span></div></>);
}
