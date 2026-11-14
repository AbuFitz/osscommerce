import { notFound } from 'next/navigation';
import { StorefrontPage, CONCEPTS, type Variant } from '@/components/StorefrontPage';
export const metadata = { robots: { index: false } };
export const generateStaticParams = () => Object.keys(CONCEPTS).map(v => ({ v }));
export const dynamicParams = false;
/** Capture target for hero textures (1600 x 1000). Not linked or indexed. */
export default async function Concept({ params, searchParams }: { params: Promise<{ v: string }>; searchParams: Promise<{ m?: string }> }) {
  const { v } = await params; if (!(v in CONCEPTS)) notFound();
  const m = (await searchParams).m === '1';
  return <div style={{ width: m ? 390 : 1600, height: m ? 844 : 1000 }}><StorefrontPage v={v as Variant} mobile={m} /></div>;
}
