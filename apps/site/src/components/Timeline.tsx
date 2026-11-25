'use client';
import { useRef } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

/** Four steps on a line that draws itself as you scroll. Big numerals, no cards. */
export function Timeline({ steps }: { steps: readonly (readonly [string, string])[] }) {
  const ref = useRef<HTMLOListElement>(null); const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 55%'] }); const p = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  return (<ol ref={ref} className="tl"><span className="tl-line" aria-hidden><motion.i style={{ scaleY: p }} /></span>
    {steps.map(([b, t], i) => (<motion.li key={b} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -12% 0px' }} transition={{ type: 'spring', bounce: 0.12, duration: 0.9 }}>
      <span className="tl-n" aria-hidden>0{i + 1}</span><div><h3>{b}</h3><p>{t}</p></div></motion.li>))}</ol>);
}
