'use client';
import { useEffect, useRef } from 'react';

/** One reveal language for the whole page: rise and fade, staggered by `i`. Content is visible without JS and under reduced motion. */
export function Reveal({ children, i = 0, className = '', as: Tag = 'div' }: { children: React.ReactNode; i?: number; className?: string; as?: 'div' | 'section' | 'li' | 'figure' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect(); if (r.top < innerHeight * 0.92 && r.bottom > 0) return; // already on screen: no flash
    el.dataset.r = 'hide';
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.r = 'show'; io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = Tag as any;
  return <T ref={ref} className={className} style={{ ['--d' as string]: i }}>{children}</T>;
}
