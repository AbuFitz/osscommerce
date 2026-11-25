'use client';
import { useEffect, useRef, useState } from 'react';

export type GlobePoint = { lat: number; lng: number; size?: number; warm?: boolean };
/** A dotted globe (cobe, MIT): green points for places, amber for the newest. Static for people who prefer reduced motion, and quietly absent without WebGL. */
export function Globe({ points, phi0 = 5.2, theta = 0.32, scale = 1.05, speed = 0.004, size = 460, className }: { points: GlobePoint[]; phi0?: number; theta?: number; scale?: number; speed?: number; size?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [ready, setReady] = useState(false);
  useEffect(() => {
    let globe: { update: (o: object) => void; destroy: () => void } | null = null, raf = 0, dead = false, phi = phi0; const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    (async () => {
      try {
        const createGlobe = (await import('cobe')).default; if (dead || !canvas.current) return; const dpr = Math.min(devicePixelRatio || 1, 2);
        globe = createGlobe(canvas.current, { devicePixelRatio: dpr, width: size * dpr, height: size * dpr, phi, theta, dark: 1, diffuse: 1.5, mapSamples: 16000, mapBrightness: 7, mapBaseBrightness: 0.05, baseColor: [0.13, 0.14, 0.26], markerColor: [0.55, 0.6, 1], glowColor: [0.3, 0.34, 0.75], opacity: 0.95, scale, markerElevation: 0.015,
          markers: points.map(p => ({ location: [p.lat, p.lng] as [number, number], size: p.size ?? 0.045, color: (p.warm ? [1, 0.76, 0.3] : [0.55, 0.62, 1]) as [number, number, number] })) });
        setReady(true); const loop = () => { if (dead) return; if (!still && !document.hidden) { phi += speed; globe!.update({ phi }); } raf = requestAnimationFrame(loop); }; loop();
      } catch { /* no WebGL */ }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); globe?.destroy(); };
  }, [points, phi0, theta, scale, speed, size]);
  return <canvas ref={canvas} className={className} width={size * 2} height={size * 2} data-ready={ready} role="img" aria-label="A globe with glowing points where sample orders were delivered" />;
}
