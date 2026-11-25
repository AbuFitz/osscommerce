'use client';
import { motion } from 'motion/react';

/** Rises into place the first time it scrolls into view. Static for people who prefer reduced motion. */
export function Reveal({ children, delay = 0, y = 28, className, as = 'div' }: { children: React.ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'li' }) {
  const M = as === 'li' ? motion.li : motion.div;
  return (<M className={className} data-reveal initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -80px 0px' }} transition={{ type: 'spring', bounce: 0.12, duration: 0.9, delay }}>{children}</M>);
}
