'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Globe, type GlobePoint } from './Globe';

const PLACES: GlobePoint[] = [{ lat: 51.5, lng: -0.12, size: 0.035 }, { lat: 51.45, lng: -2.58, size: 0.03 }, { lat: 53.48, lng: -2.24, size: 0.025 }, { lat: 55.95, lng: -3.19, size: 0.025 }, { lat: 51.48, lng: -3.18, size: 0.025 }, { lat: 53.35, lng: -6.26, size: 0.025 }, { lat: 48.85, lng: 2.35, size: 0.025 }, { lat: 52.52, lng: 13.4, size: 0.025 }, { lat: 52.37, lng: 4.9, size: 0.025, warm: true }, { lat: 40.71, lng: -74.0, size: 0.025, warm: true }, { lat: 43.65, lng: -79.38, size: 0.025 }, { lat: -33.87, lng: 151.2, size: 0.025 }, { lat: 35.68, lng: 139.7, size: 0.025 }];
const CHIPS = [{ t: 'Order #1042', w: 'Bath', v: '£21.15', x: '8%', y: '30%' }, { t: 'Order #1043', w: 'Glasgow', v: '£68.00', x: '70%', y: '22%' }, { t: 'Order #1044', w: 'Dublin', v: '£34.50', x: '78%', y: '52%' }, { t: 'Order #1045', w: 'Amsterdam', v: '£126.00', x: '4%', y: '58%' }, { t: 'Order #1046', w: 'New York', v: '£54.95', x: '62%', y: '66%' }];
/** The big one: a globe rising from the bottom edge, with orders arriving around it. All sample data. */
export function LiveSection() {
  const [i, setI] = useState(0); useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const t = setInterval(() => setI(k => (k + 1) % CHIPS.length), 2600); return () => clearInterval(t); }, []);
  const shown = [CHIPS[i], CHIPS[(i + 1) % CHIPS.length]];
  return (<div className="livesec"><div className="live-g"><Globe points={PLACES} size={900} scale={1.02} speed={0.0025} phi0={5.1} theta={0.4} /></div>
    <div className="live-t"><p className="live-k"><i />Live view</p><h2>Watch the orders<br />arrive.</h2></div>
    <AnimatePresence>{shown.map(c => (<motion.div key={c.t} className="chip" style={{ left: c.x, top: c.y }} initial={{ opacity: 0, scale: 0.85, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', bounce: 0.25, duration: 0.6 }}><b>{c.t}</b><span>{c.w}</span><em>{c.v}</em></motion.div>))}</AnimatePresence>
    <p className="sample live-s">Sample data</p></div>);
}
