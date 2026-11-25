'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';

function Word({ w, i, n, p }: { w: string; i: number; n: number; p: MotionValue<number> }) {
  const o = useTransform(p, [i / n, Math.min(1, (i + 2.5) / n)], [0.16, 1]);
  return <motion.span style={{ opacity: o }}>{w} </motion.span>;
}
/** One big sentence that fills in word by word as you scroll past it. No title, no tag. */
export function Statement({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null); const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] }); const words = text.split(' ');
  return (<p ref={ref} className="state" aria-label={text}>{words.map((w, i) => <Word key={i} w={w} i={i} n={words.length} p={scrollYProgress} />)}</p>);
}
