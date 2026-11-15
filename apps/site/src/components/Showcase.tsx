'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
/** A screen recording of the real dashboard (demo data). Muted and looping; it only plays on its own when motion is welcome and it is on screen, and it can always be paused. */
export function Showcase({ label = 'Screen recording of the dashboard: opening an order and marking it as fulfilled, then sales and stock' }: { label?: string }) {
  const v = useRef<HTMLVideoElement>(null); const [playing, setPlaying] = useState(false); const [user, setUser] = useState(false);
  useEffect(() => {
    const el = v.current; if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => { if (user) return; if (e.isIntersecting) el.play().then(() => setPlaying(true)).catch(() => {}); else { el.pause(); setPlaying(false); } }, { threshold: .35 });
    io.observe(el); return () => io.disconnect();
  }, [user]);
  const toggle = () => { const el = v.current; if (!el) return; setUser(true); if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); } };
  return (<figure className="vid"><video ref={v} src="/video/dashboard.webm" poster="/video/dashboard-poster.jpg" muted loop playsInline preload="metadata" aria-label={label} width={1280} height={800} />
    <button type="button" className="vid-btn" onClick={toggle} aria-label={playing ? 'Pause the recording' : 'Play the recording'}>{playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}</button>
    <figcaption className="sr">{label}</figcaption></figure>);
}
