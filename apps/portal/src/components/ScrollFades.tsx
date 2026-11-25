'use client';
import { useEffect } from 'react';

/** Soft fades at the edges of any scrollable area marked data-fade: they show only on the side where there is more to scroll to. */
export function ScrollFades() {
  useEffect(() => {
    const set = (el: Element) => {
      const e = el as HTMLElement; const max = e.scrollHeight - e.clientHeight;
      e.toggleAttribute('data-fade-top', max > 2 && e.scrollTop > 2); e.toggleAttribute('data-fade-bottom', max > 2 && e.scrollTop < max - 2);
    };
    const all = () => document.querySelectorAll('[data-fade]').forEach(set);
    const onScroll = (ev: Event) => { const t = ev.target; if (t instanceof Element && t.hasAttribute('data-fade')) set(t); };
    let raf = 0; const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(all); };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    addEventListener('resize', soon);
    const mo = new MutationObserver(soon); mo.observe(document.body, { childList: true, subtree: true });
    all();
    return () => { document.removeEventListener('scroll', onScroll, { capture: true }); removeEventListener('resize', soon); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
