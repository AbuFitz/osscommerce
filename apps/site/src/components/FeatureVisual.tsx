import { Browser, Phone, Shot } from './Frames';
import { StoreDemo } from './StoreDemo';
import { PayCalc } from './PayCalc';
import type { Feature } from '@/content/features';
export function FeatureVisual({ v }: { v: Feature['visual'] }) {
  if (v.kind === 'calc') return <PayCalc />;
  if (v.kind === 'store') return <div className="vis-store"><Browser url="yourbrand.co.uk/shop/your-product"><StoreDemo /></Browser><Phone><StoreDemo variant="phone" /></Phone><p className="cap">A layout sketch. Your storefront is designed from scratch around your brand and photography.</p></div>;
  return <div className="vis-shot"><Browser><Shot name={v.name} alt={v.alt} eager /></Browser><p className="cap">The real dashboard, shown with demo data.</p></div>;
}
