'use client';
import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';

export function Faq({ items }: { items: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState<number | null>(null); const id = useId();
  return (<div className="faq">{items.map(([q, a], i) => (
    <div className="q" key={q}>
      <button type="button" aria-expanded={open === i} aria-controls={`${id}-${i}`} onClick={() => setOpen(open === i ? null : i)}>{q}<span className="pm"><Plus size={16} aria-hidden /></span></button>
      <AnimatePresence initial={false}>{open === i && (
        <motion.div id={`${id}-${i}`} role="region" className="a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', bounce: 0.1, duration: 0.45 }}><p>{a}</p></motion.div>)}
      </AnimatePresence>
    </div>))}</div>);
}
