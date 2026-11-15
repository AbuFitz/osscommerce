import { PhoneUploader } from '@/components/PhoneUploader';
export const metadata = { title: 'Add photos', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function PhoneHandoff({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="hd"><PhoneUploader token={token} /></main>;
}
