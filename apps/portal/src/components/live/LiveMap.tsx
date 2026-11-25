'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Map as MapIcon, Radio } from 'lucide-react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { MapPoint, RecentOrder } from '@/lib/geo/points';
import { faceLng, project } from '@/lib/geo/project';
import { ago, money } from '@/lib/format';

type Mode = 'globe' | 'map';
const W = 960, H = 500, SCALE = 1.12;
const fresh = (p: MapPoint, ref: string) => Date.parse(ref) - Date.parse(p.lastAt) < 3 * 3600_000;
const size = (p: MapPoint) => Math.min(0.07, 0.022 + Math.sqrt(p.orders) * 0.008);

/** Shopify-style live view: a spinning globe where WebGL and motion allow it, a flat map everywhere else, one list of places beside both. */
export function LiveMap({ points, recent, asOf, tracked }: { points: MapPoint[]; recent: RecentOrder[]; asOf: string; tracked: boolean }) {
  const [mode, setMode] = useState<Mode>('globe'); const [glOk, setGlOk] = useState(true); const [sel, setSel] = useState<string | null>(null);
  const chosen = points.find(p => p.id === sel) ?? null; const top = points[0];
  const pick = useCallback((id: string | null) => setSel(s => (s === id ? null : id)), []);
  useEffect(() => { if (!glOk) setMode('map'); }, [glOk]);
  const metric = tracked ? 'sessions' : 'orders';
  return (
    <section className="w dark gl" aria-labelledby="gl-h">
      <div className="gl-stage">
        <div className="gl-bar">
          <div><h2 id="gl-h">Where orders are going</h2><p>{points.length ? `${points.reduce((n, p) => n + p.orders, 0)} orders to ${points.length} ${points.length === 1 ? 'place' : 'places'} in the last 30 days` : 'No deliveries to show yet'}</p></div>
          <div className="gl-seg" role="group" aria-label="Map style">
            <button type="button" data-on={mode === 'globe'} aria-pressed={mode === 'globe'} disabled={!glOk} onClick={() => setMode('globe')}><Globe2 size={15} aria-hidden />Globe</button>
            <button type="button" data-on={mode === 'map'} aria-pressed={mode === 'map'} onClick={() => setMode('map')}><MapIcon size={15} aria-hidden />Map</button>
          </div>
        </div>
        <div className="gl-view">
          {mode === 'globe' ? <Globe points={points} asOf={asOf} sel={sel} onPick={pick} onFail={() => setGlOk(false)} initial={top} /> : <FlatMap points={points} asOf={asOf} sel={sel} onPick={pick} />}
          {!points.length && <p className="gl-empty">Orders appear on the map as soon as your first one is delivered somewhere.</p>}
          {chosen && <PlaceCard p={chosen} asOf={asOf} onClose={() => setSel(null)} />}
        </div>
      </div>
      <div className="gl-side">
        <div>
          <h3>Top places</h3>
          {points.length === 0 ? <p className="muted-d">Nothing yet.</p> : <ul className="gl-places">{points.slice(0, 6).map(p => (
            <li key={p.id}><button type="button" data-on={sel === p.id} onClick={() => pick(p.id)}><span>{p.place.replace(/, United Kingdom$/, '')}</span><b>{tracked && p.sessions != null ? p.sessions : p.orders}<small> {metric}</small></b><i style={{ width: `${(p.orders / (points[0]?.orders || 1)) * 100}%` }} aria-hidden /></button></li>))}</ul>}
        </div>
        <div>
          <h3><Radio size={13} aria-hidden /> Latest orders</h3>
          {recent.length === 0 ? <p className="muted-d">No orders yet.</p> : <ul className="gl-recent">{recent.slice(0, 5).map(o => (
            <li key={o.id}><span><b>#{o.number}</b> {o.place.replace(/, United Kingdom$/, '')}</span><span>{money(o.totalMinor)}<small>{ago(o.at, asOf)}</small></span></li>))}</ul>}
        </div>
      </div>
    </section>
  );
}

function PlaceCard({ p, asOf, onClose }: { p: MapPoint; asOf: string; onClose: () => void }) {
  return (
    <div className="gl-card" role="status">
      <button type="button" className="gl-x" onClick={onClose} aria-label="Close">×</button>
      <b>{p.place}</b>
      <dl><div><dt>Orders</dt><dd>{p.orders}</dd></div><div><dt>Sales</dt><dd>{money(p.salesMinor)}</dd></div>{p.sessions != null && <div><dt>Visits</dt><dd>{p.sessions}</dd></div>}<div><dt>Latest</dt><dd>{ago(p.lastAt, asOf)}</dd></div></dl>
      {p.precision === 'country' && <small>Shown at the middle of the country: the town was not recognised.</small>}
    </div>
  );
}

function Tip({ p, asOf }: { p: MapPoint; asOf: string }) { return <span className="gl-tip"><b>{p.place}</b>{p.orders} {p.orders === 1 ? 'order' : 'orders'} · {money(p.salesMinor)}<small>{ago(p.lastAt, asOf)}</small></span>; }

/** ---- Globe ---- cobe draws the sphere and glow; the hover targets are ordinary buttons placed with the same projection, so they work with keyboard and touch. */
function Globe({ points, asOf, sel, onPick, onFail, initial }: { points: MapPoint[]; asOf: string; sel: string | null; onPick: (id: string | null) => void; onFail: () => void; initial?: MapPoint }) {
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null); const pins = useRef(new Map<string, HTMLButtonElement>());
  const st = useRef({ phi: faceLng(initial?.lng ?? -2), theta: Math.min(0.8, Math.max(0.1, ((initial?.lat ?? 40) * Math.PI) / 180 * 0.8)), drag: false, x: 0, y: 0, hold: false, still: false, size: 0 });
  const selRef = useRef(sel); selRef.current = sel; const [ready, setReady] = useState(false);
  useEffect(() => {
    const cv = canvas.current!, wrap = box.current!; const s = st.current; s.still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let globe: { update: (o: object) => void; destroy: () => void } | null = null, raf = 0, dead = false, hidden = false;
    const measure = () => { const r = wrap.getBoundingClientRect(); s.size = Math.round(Math.min(r.width, r.height)); return s.size; };
    const place = () => { for (const p of points) { const el = pins.current.get(p.id); if (!el) continue; const q = project(p.lat, p.lng, s.phi, s.theta, SCALE); el.style.transform = `translate(${(50 + q.x * 50).toFixed(2)}cqw, ${(50 + q.y * 50).toFixed(2)}cqh) translate(-50%,-50%)`; const on = q.z > 0.08; el.style.opacity = on ? '1' : '0'; el.style.pointerEvents = on ? 'auto' : 'none'; el.tabIndex = on ? 0 : -1; } };
    (async () => {
      let createGlobe: typeof import('cobe').default; try { createGlobe = (await import('cobe')).default; } catch { return onFail(); }
      if (dead) return; const n = measure() || 480; const dpr = Math.min(window.devicePixelRatio || 1, 2);
      try {
        globe = createGlobe(cv, { devicePixelRatio: dpr, width: n * dpr, height: n * dpr, phi: s.phi, theta: s.theta, dark: 1, scale: SCALE, diffuse: 1.5, mapSamples: 16000, mapBrightness: 7, mapBaseBrightness: 0.05, baseColor: [0.2, 0.27, 0.12], markerColor: [0.9, 0.97, 0.37], glowColor: [0.28, 0.4, 0.14], opacity: 0.95, markerElevation: 0.015,
          markers: points.map(p => ({ location: [p.lat, p.lng] as [number, number], size: size(p), color: (fresh(p, asOf) ? [0.9, 0.97, 0.37] : [0.72, 0.82, 0.45]) as [number, number, number] })), context: { antialias: true } });
      } catch { return onFail(); }
      setReady(true); place();
      const loop = () => {
        if (dead) return; raf = requestAnimationFrame(loop); if (hidden) return;
        if (!s.still && !s.drag && !s.hold && !selRef.current) s.phi += 0.0035;
        const sz = Math.round(Math.min(wrap.clientWidth, wrap.clientHeight)); if (sz && sz !== s.size) { s.size = sz; globe!.update({ width: sz * dpr, height: sz * dpr }); }
        globe!.update({ phi: s.phi, theta: s.theta }); place();
      };
      loop();
    })();
    const vis = () => { hidden = document.hidden; }; document.addEventListener('visibilitychange', vis);
    return () => { dead = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); globe?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, asOf]);
  // Bring a chosen place to the front.
  useEffect(() => { const p = points.find(q => q.id === sel); if (!p) return; const s = st.current; const to = faceLng(p.lng); const tt = Math.min(0.8, Math.max(-0.3, (p.lat * Math.PI) / 180 * 0.8)); let raf = 0; const step = () => { let d = to - s.phi; d = Math.atan2(Math.sin(d), Math.cos(d)); s.phi += d * 0.12; s.theta += (tt - s.theta) * 0.12; if (Math.abs(d) > 0.003 || Math.abs(tt - s.theta) > 0.003) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [sel, points]);
  const down = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest('.gl-pin')) return; const s = st.current; s.drag = true; s.x = e.clientX; s.y = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { const s = st.current; if (!s.drag) return; const k = 3.2 / Math.max(s.size, 200); s.phi += (e.clientX - s.x) * k; if (e.pointerType === 'mouse') s.theta = Math.max(-0.7, Math.min(0.9, s.theta + (e.clientY - s.y) * k)); s.x = e.clientX; s.y = e.clientY; };
  const up = () => { st.current.drag = false; };
  return (
    <div className="gl-globe" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerEnter={() => { st.current.hold = true; }} onPointerLeave={() => { st.current.hold = false; up(); }}>
      <canvas ref={canvas} className="gl-canvas" data-ready={ready} role="img" aria-label={`Globe showing ${points.length} delivery places. The list beside it has the same information.`} />
      <div className="gl-pins">{points.map(p => (
        <button key={p.id} type="button" className="gl-pin" data-new={fresh(p, asOf)} data-on={sel === p.id} ref={el => { if (el) pins.current.set(p.id, el); else pins.current.delete(p.id); }} onClick={() => onPick(p.id)} aria-label={`${p.place}: ${p.orders} orders`} aria-pressed={sel === p.id} style={{ opacity: 0 }}><i aria-hidden /><Tip p={p} asOf={asOf} /></button>))}</div>
    </div>
  );
}

/** ---- Flat map ---- natural-earth projection of Natural Earth country shapes (public domain). Zooms to where the customers are. */
type Geo = { type: 'FeatureCollection'; features: object[] };
function FlatMap({ points, asOf, sel, onPick }: { points: MapPoint[]; asOf: string; sel: string | null; onPick: (id: string | null) => void }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const near = useMemo(() => points.length ? points.filter(p => Math.abs(p.lat - points[0].lat) < 12 && Math.abs(p.lng - points[0].lng) < 20) : [], [points]);
  const [view, setView] = useState<'near' | 'all' | 'world'>(near.length > 1 && near.length < points.length ? 'near' : points.length ? 'all' : 'world');
  useEffect(() => { let off = false; fetch('/geo/countries.json').then(r => r.json()).then(t => { if (!off) setGeo(feature(t, t.objects.countries) as unknown as Geo); }).catch(() => undefined); return () => { off = true; }; }, []);
  const { paths, pos } = useMemo(() => {
    if (!geo) return { paths: [] as string[], pos: new Map<string, [number, number]>() };
    const proj = geoNaturalEarth1(); const pad = 18;
    if (view !== 'world' && points.length) {
      const use = view === 'near' ? near : points; const lats = use.map(p => p.lat), lngs = use.map(p => p.lng); const cy = (Math.min(...lats) + Math.max(...lats)) / 2, cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      const hy = Math.max((Math.max(...lats) - Math.min(...lats)) / 2, 6), hx = Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2, hy * 1.7);
      proj.fitExtent([[pad, pad], [W - pad, H - pad]], { type: 'MultiPoint', coordinates: [[cx - hx * 1.25, cy - hy * 1.25], [cx + hx * 1.25, cy + hy * 1.25], [cx - hx * 1.25, cy + hy * 1.25], [cx + hx * 1.25, cy - hy * 1.25]] });
    } else proj.fitExtent([[0, 0], [W, H]], { type: 'Sphere' });
    const path = geoPath(proj); const pos = new Map<string, [number, number]>();
    for (const p of points) { const xy = proj([p.lng, p.lat]); if (xy) pos.set(p.id, xy); }
    return { paths: (geo.features as object[]).map(f => path(f as never) ?? '').filter(Boolean), pos };
  }, [geo, view, points, near]);
  return (
    <div className="gl-flat">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map showing ${points.length} delivery places. The list beside it has the same information.`} preserveAspectRatio="xMidYMid slice">{paths.map((d, i) => <path key={i} d={d} />)}</svg>
      {!geo && <p className="gl-empty">Loading map…</p>}
      {[...points].reverse().map(p => { const xy = pos.get(p.id); if (!xy || xy[0] < 0 || xy[0] > W || xy[1] < 0 || xy[1] > H) return null; return (
        <button key={p.id} type="button" className="gl-pin" data-new={fresh(p, asOf)} data-on={sel === p.id} style={{ left: `${(xy[0] / W) * 100}%`, top: `${(xy[1] / H) * 100}%`, ['--s' as string]: `${Math.round(size(p) * 260)}px` }} onClick={() => onPick(p.id)} aria-label={`${p.place}: ${p.orders} orders`} aria-pressed={sel === p.id}><i aria-hidden /><Tip p={p} asOf={asOf} /></button>); })}
      {points.length > 0 && <div className="gl-seg gl-zoom" role="group" aria-label="Zoom">{near.length > 1 && near.length < points.length && <button type="button" data-on={view === 'near'} aria-pressed={view === 'near'} onClick={() => setView('near')}>Nearby</button>}<button type="button" data-on={view === 'all'} aria-pressed={view === 'all'} onClick={() => setView('all')}>All places</button><button type="button" data-on={view === 'world'} aria-pressed={view === 'world'} onClick={() => setView('world')}>World</button></div>}
    </div>
  );
}
