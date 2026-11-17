import { Phone } from './Frames';
import { STORES, StoreMock } from './stores';
const ROT = [-9, -3, 3, 9]; const Y = [34, 6, 6, 34];
/** Four different businesses, four different stores, one platform. A static fan of phones. */
export function StoreFan() {
  return (<div className="fan" role="group" aria-label="Four example storefronts, each with its own design">{STORES.map((s, i) => <Phone key={s.id} style={{ ['--rot' as string]: `${ROT[i]}deg`, ['--y' as string]: `${Y[i]}px` }}><StoreMock s={s} /></Phone>)}</div>);
}
