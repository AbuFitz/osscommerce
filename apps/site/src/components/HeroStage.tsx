'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Globe, type GlobePoint } from './Globe';

/** Illustrative only: a made-up set of orders to show what the live view looks like. Labelled as sample data on the page. */
const SAMPLE = [
  { who: 'Order #1042', where: 'Bath', total: '£21.15', at: [51.38, -2.36] }, { who: 'Order #1043', where: 'Glasgow', total: '£68.00', at: [55.86, -4.25] },
  { who: 'Order #1044', where: 'Dublin', total: '£34.50', at: [53.35, -6.26] }, { who: 'Order #1045', where: 'Amsterdam', total: '£126.00', at: [52.37, 4.9] },
  { who: 'Order #1046', where: 'New York', total: '£54.95', at: [40.71, -74.0] }, { who: 'Order #1047', where: 'Leeds', total: '£41.00', at: [53.8, -1.55] },
] as const;
const PLACES: GlobePoint[] = [[51.5, -0.12], [51.45, -2.58], [53.48, -2.24], [55.95, -3.19], [51.48, -3.18], [53.35, -6.26], [48.85, 2.35], [52.52, 13.4], [52.37, 4.9], [40.71, -74.0], [43.65, -79.38], [-33.87, 151.2], [35.68, 139.7]].map(([lat, lng], k) => ({ lat, lng, size: k < 3 ? 0.06 : 0.04, warm: k % 4 === 0 }));

export function HeroStage() {
  const [list, setList] = useState<{ n: number; k: number }[]>([{ n: 2, k: 2 }, { n: 1, k: 1 }, { n: 0, k: 0 }]);
  const rx = useMotionValue(0), ry = useMotionValue(0); const sx = useSpring(rx, { stiffness: 120, damping: 18 }), sy = useSpring(ry, { stiffness: 120, damping: 18 });
  const tiltX = useTransform(sx, v => `${v}deg`), tiltY = useTransform(sy, v => `${v}deg`);
  useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const t = setInterval(() => { setList(l => { const n = l[0].n + 1; return [{ n, k: n % SAMPLE.length }, ...l].slice(0, 3); }); }, 3200); return () => clearInterval(t); }, []);
  return (
    <motion.div className="stage" onPointerMove={e => { if (e.pointerType !== 'mouse') return; const r = e.currentTarget.getBoundingClientRect(); ry.set(((e.clientX - r.left) / r.width - 0.5) * 5); rx.set(-((e.clientY - r.top) / r.height - 0.5) * 4); }} onPointerLeave={() => { rx.set(0); ry.set(0); }}
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.1, duration: 1.1, delay: 0.25 }}>
      <motion.div className="dash" style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}>
        <div className="dash-bar"><i /><i /><i /><span style={{ marginLeft: 8 }}>Live view</span><span className="live">Live</span></div>
        <div className="dash-body">
          <div className="globe-box"><Globe points={PLACES} /><span className="sample">Sample data</span></div>
          <div className="feed">
            <div className="kp"><small>Sales today</small><b>£1,284.60</b><span className="up">↑ 12% on yesterday</span>
              <svg className="spark" viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stopColor="#8c99ff" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient></defs>
                <motion.path d="M0 38 C16 36 22 18 40 22 S66 40 84 26 S112 6 130 16 S160 30 176 12 S192 8 200 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.8, ease: 'easeOut' }} /></svg></div>
            <AnimatePresence initial={false} mode="popLayout">{list.map(({ n, k }) => { const o = SAMPLE[k]; return (
              <motion.div key={n} layout className="ord" initial={{ opacity: 0, y: -14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}>
                <span className="dot"><ShoppingBag size={16} aria-hidden /></span><span><b>{o.who}</b><span>{o.where}</span></span><em>{o.total}</em></motion.div>); })}</AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
