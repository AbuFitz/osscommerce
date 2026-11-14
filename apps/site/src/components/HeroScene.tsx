'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Hero artifact: a storefront, its phone view and the merchant dashboard float as glass panels in depth,
 * with real 3D ceramics in front. Thesis: we build the shop and hand you the controls.
 * Enhancement only: all content lives in HTML. Falls back to a still image with no WebGL; one static frame with reduced motion.
 */
export function HeroScene() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current; if (!el) return;
    let dead = false, raf = 0; const undo: (() => void)[] = [];
    (async () => {
      const mobile = matchMedia('(max-width: 900px)').matches;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const THREE = await import('three');
      const { studio, floor, vase, bowl } = await import('@/three/objects');
      const { iphone, imac } = await import('@/three/devices');
      if (dead) return;
      let r: import('three').WebGLRenderer;
      try { r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch { return; }
      r.setClearColor(0x000000, 0); r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
      r.domElement.setAttribute('aria-hidden', 'true'); el.appendChild(r.domElement);
      undo.push(() => { r.dispose(); r.domElement.remove(); });

      const scene = new THREE.Scene(); studio(r, scene, true);
      const fl = floor(0x000000, 0.45); fl.position.y = -1.95; scene.add(fl);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60); cam.position.set(0, 0.45, mobile ? 11.8 : 14); cam.lookAt(0, -0.2, 0);
      const world = new THREE.Group(); scene.add(world);

      const loader = new THREE.TextureLoader();
      const tex = (url: string) => new Promise<import('three').Texture>(res => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; res(t); }, undefined, () => res(new THREE.Texture())));
      const [tStore, tDash, tPhone] = await Promise.all([tex('/panels/store-ceramics.jpg'), tex('/showcase/overview-desk.jpg'), tex('/panels/store-m-ceramics.jpg')]);
      if (dead) return;

      const shadowTex = () => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 34; g.shadowOffsetX = 1000; g.fillStyle = '#000'; g.beginPath(); g.roundRect(-1000 + 48, 52, 160, 140, 26); g.fill(); const t = new THREE.CanvasTexture(c); return t; };
      const sTex = shadowTex();
      const panel = (map: import('three').Texture, w: number, h: number, radius: number, alpha = false) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
          transparent: true, uniforms: { map: { value: map }, size: { value: new THREE.Vector2(w, h) }, radius: { value: radius }, useAlpha: { value: alpha ? 1 : 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
          fragmentShader: `uniform sampler2D map; uniform vec2 size; uniform float radius; uniform float useAlpha; varying vec2 vUv;
            float sd(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
            void main(){ vec2 p = (vUv - .5) * size; float d = sd(p, size * .5, radius); float px = fwidth(d); float a = 1. - smoothstep(-px, px, d);
              vec4 tx = texture2D(map, vUv); vec3 c = tx.rgb; float rim = 1. - smoothstep(0., .03, -d); float sheen = smoothstep(1.1, 0., vUv.y + (1. - vUv.x) * .5) * .06;
              if (useAlpha > .5) { gl_FragColor = vec4(c, tx.a); } else { gl_FragColor = vec4(c + vec3(sheen) + vec3(rim * .3), a); }
              #include <colorspace_fragment>
            }` }));
        const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 1.6), new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false, opacity: .8 }));
        s.position.set(0, -h * 0.09, -0.05); if (alpha) g.add(m); else g.add(s, m); return g;
      };
      type PanelDef = { g: import('three').Group; base: import('three').Vector3; ry: number; ph: number };
      const defs: PanelDef[] = [];
      const add = (map: import('three').Texture, w: number, h: number, rad: number, x: number, y: number, z: number, ry: number, alpha = false) => { const g = panel(map, w, h, rad, alpha); g.position.set(x, y, z); g.rotation.set(0.03, ry, 0); world.add(g); defs.push({ g, base: g.position.clone(), ry, ph: Math.random() * 6 }); };
      // Real 3D devices. The laptop stands on the floor, the phone floats and leans toward the viewer.
      const phone = iphone(tPhone); const mac = imac(tStore);
      if (mobile) {
        add(tDash, 3.0, 1.875, 0.1, 1.0, 1.15, -0.9, -0.26);
        phone.position.set(-0.55, 0.0, 0.7); phone.rotation.set(0.04, 0.32, -0.03); phone.scale.setScalar(1.0); world.add(phone); defs.push({ g: phone, base: phone.position.clone(), ry: 0.32, ph: 1 });
      } else {
        mac.position.set(0.15, -1.95, -1.9); mac.rotation.y = -0.24; mac.scale.setScalar(1.04); world.add(mac);
        add(tDash, 2.35, 1.47, 0.1, 2.75, -0.75, 1.3, -0.36);
        phone.position.set(-2.35, -0.35, 1.0); phone.rotation.set(0.05, 0.42, -0.04); phone.scale.setScalar(0.92); world.add(phone); defs.push({ g: phone, base: phone.position.clone(), ry: 0.42, ph: 2 });
      }

      const v1 = vase(0xc4623a, 2.1), v2 = vase(0xf0e8d8, 1.4), b1 = bowl(0x6f8a6a);
      const sc = mobile ? 0.42 : 0.52;
      v1.position.set(mobile ? -1.4 : -0.95, -1.95, 2.3); v1.scale.setScalar(sc);
      v2.position.set(mobile ? -0.45 : 0.05, -1.95, 2.8); v2.scale.setScalar(sc * 0.78);
      b1.position.set(mobile ? 0.65 : 1.05, -1.95, 2.5); b1.scale.setScalar(sc * 0.8);
      world.add(v1, v2, b1);

      const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; cam.aspect = w / h; cam.updateProjectionMatrix(); };
      size(); const ro = new ResizeObserver(size); ro.observe(el); undo.push(() => ro.disconnect());

      const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      if (!mobile && !still) { const mv = (e: PointerEvent) => { target.y = (e.clientX / innerWidth - .5) * 0.22; target.x = (e.clientY / innerHeight - .5) * 0.1; }; addEventListener('pointermove', mv); undo.push(() => removeEventListener('pointermove', mv)); }
      let visible = true; const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !still) loop(); }); io.observe(el); undo.push(() => io.disconnect());

      const frame = (t: number) => {
        const s = still ? 0 : t / 1000;
        cur.x += (target.x - cur.x) * 0.06; cur.y += (target.y - cur.y) * 0.06;
        world.rotation.set(cur.x, cur.y - (mobile ? Math.sin(s * .4) * .04 : 0), 0);
        world.position.y = -Math.min(scrollY, 800) * 0.0016;
        defs.forEach((d, i) => { d.g.position.y = d.base.y + Math.sin(s * .7 + d.ph) * (mobile ? .05 : .08); d.g.rotation.y = d.ry + Math.sin(s * .3 + i) * .03; });
        v1.rotation.y = s * .25; v2.rotation.y = -s * .2; b1.rotation.y = s * .15;
        r.render(scene, cam);
      };
      const loop = () => { cancelAnimationFrame(raf); const tick = (t: number) => { if (dead || !visible) return; frame(t); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); };
      frame(0); setReady(true);
      if (!still) loop();
      undo.push(() => cancelAnimationFrame(raf));
    })().catch(() => {});
    return () => { dead = true; undo.forEach(f => f()); };
  }, []);

  return (
    <div className="scene" ref={host} data-ready={ready}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="fb" src="/panels/hero-fallback.webp" alt="" width={1100} height={1000} fetchPriority="high" />
    </div>
  );
}
