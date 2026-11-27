import Link from 'next/link';
import { gate } from '@/lib/gate';
import { gateway } from '@/lib/gateway-instance';
import { Header } from '@/components/ui';
import { MenuEditor } from '@/components/site/MenuEditor';
import { MENUS } from '@/lib/site-content';
export const metadata = { title: 'Menus' };
export default async function Menus() {
  await gate('/content');
  const menus = await gateway().menus();
  return (<><Header title="Menus" eyebrow="Links on every page of your store" /><nav className="seg" aria-label="Content areas" style={{ marginBottom: 14 }}><Link href="/content">Homepage</Link><Link href="/content/pages">Pages</Link><Link href="/content/menus" aria-current="page">Menus</Link></nav>
    {menus.length === 0 ? <div className="w empty">Editing menus is not connected for your store yet.</div> : <div className="mn-grid">{menus.map(m => <MenuEditor key={m.key} menu={m} hint={MENUS[m.key].hint} />)}</div>}
    <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>A link can go to a page on your shop (starting with /, such as /pages/our-story) or to another site (https://…). Shoppers see a menu only after you publish it.</p></>);
}
