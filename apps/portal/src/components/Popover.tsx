'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Placement = 'bottom-end' | 'right-end' | 'top-start' | 'bottom-start';
/** A small floating panel anchored to a button. Rendered in the page body so no clipping or stacking context can hide it; kept inside the window;
 *  closes on Esc, on a click outside and when the anchor scrolls away; hands focus to the panel and back to the button. */
export function Popover({ open, onClose, anchor, placement = 'bottom-end', label, width = 360, children }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement | null>; placement?: Placement; label: string; width?: number; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) { setPos(null); return; }
    const place = () => {
      const a = anchor.current!.getBoundingClientRect(), h = panel.current?.offsetHeight ?? 320, w = Math.min(width, innerWidth - 16), gap = 10; let left = 0, top = 0, origin = 'top right';
      if (placement === 'bottom-end') { left = a.right - w; top = a.bottom + gap; origin = 'top right'; }
      else if (placement === 'bottom-start') { left = a.left; top = a.bottom + gap; origin = 'top left'; }
      else if (placement === 'right-end') { left = a.right + gap; top = a.bottom - h; origin = 'bottom left'; }
      else { left = a.left; top = a.top - h - gap; origin = 'bottom left'; }
      setPos({ left: Math.max(8, Math.min(left, innerWidth - w - 8)), top: Math.max(8, Math.min(top, innerHeight - h - 8)), origin });
    };
    place(); const raf = requestAnimationFrame(place); addEventListener('resize', place); addEventListener('scroll', place, true);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', place); removeEventListener('scroll', place, true); };
  }, [open, anchor, placement, width]);
  useEffect(() => {
    if (!open) return; const a = anchor.current;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); a?.focus(); } };
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !a?.contains(t)) onClose(); };
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', down); panel.current?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); };
  }, [open, onClose, anchor]);
  if (!open) return null;
  return createPortal(<div ref={panel} role="dialog" aria-label={label} tabIndex={-1} className="fpanel" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(width, 9999), maxWidth: 'calc(100vw - 16px)', transformOrigin: pos?.origin, visibility: pos ? 'visible' : 'hidden' }}>{children}</div>, document.body);
}
