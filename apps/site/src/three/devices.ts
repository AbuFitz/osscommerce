import * as THREE from 'three';

/** Real 3D device models: beveled metal bodies, black glass bezels, lit by the studio environment. Screens take any texture. */
const rrShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false); return s;
};
const slab = (w: number, h: number, d: number, r: number, mat: THREE.Material, bevel = 0.03) => {
  const g = new THREE.ExtrudeGeometry(rrShape(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.01)), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 24 });
  g.translate(0, 0, -d / 2); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
};
const flat = (w: number, h: number, r: number, mat: THREE.Material) => new THREE.Mesh(new THREE.ShapeGeometry(rrShape(w, h, r), 24), mat);

/** Screen with rounded corners: samples the texture, masks to a rounded rect, adds a faint glass sheen. Not tone-mapped, so the content stays true. */
export function screenMaterial(map: THREE.Texture, w: number, h: number, radius: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { map: { value: map }, size: { value: new THREE.Vector2(w, h) }, radius: { value: radius } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform vec2 size; uniform float radius; varying vec2 vUv;
      float sd(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
      void main(){ vec2 p = (vUv - .5) * size; float d = sd(p, size * .5, radius); float a = 1. - smoothstep(-fwidth(d), fwidth(d), d);
        vec3 c = texture2D(map, vUv).rgb; float sheen = smoothstep(1.15, 0., vUv.y + (1. - vUv.x) * .55) * .07;
        gl_FragColor = vec4(c + vec3(sheen), a);
        #include <colorspace_fragment>
      }` });
}
const screenPlane = (map: THREE.Texture, w: number, h: number, r: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMaterial(map, w, h, r)); return m; };

export type Finish = 'titanium' | 'silver';
const metal = (f: Finish) => new THREE.MeshPhysicalMaterial(f === 'titanium'
  ? { color: 0x34363a, metalness: 1, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.35 }
  : { color: 0xd3d6da, metalness: 1, roughness: 0.24, clearcoat: 0.2 });
const glass = () => new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });

/** iPhone-style phone. Origin at centre, facing +z. Height 3.0 units. */
export function iphone(screen: THREE.Texture, finish: Finish = 'titanium') {
  const W = 1.45, H = 3.0, D = 0.13, g = new THREE.Group();
  g.add(slab(W, H, D, 0.26, metal(finish)));
  const z = D / 2 + 0.034;
  const bezel = flat(W - 0.075, H - 0.075, 0.225, glass()); bezel.position.z = z; g.add(bezel);
  const sw = W - 0.2, sh = H - 0.2; const scr = screenPlane(screen, sw, sh, 0.17); scr.position.z = z + 0.002; g.add(scr);
  const island = flat(0.4, 0.115, 0.057, new THREE.MeshBasicMaterial({ color: 0x000000 })); island.position.set(0, H / 2 - 0.19, z + 0.004); g.add(island);
  const btn = (x: number, y: number, h: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.07), metal(finish)); b.position.set(x, y, 0); b.castShadow = true; g.add(b); };
  btn(-W / 2 - 0.012, 0.75, 0.24); btn(-W / 2 - 0.012, 0.28, 0.4); btn(-W / 2 - 0.012, -0.2, 0.4); btn(W / 2 + 0.012, 0.3, 0.55);
  return g;
}

/** Studio-display style desktop (iMac-like): aluminium frame, thin black glass bezel, stand arm with an oval cut-out, flat foot.
 *  Origin at the floor under the centre, facing +z. Overall height about 4.6 units. */
export function imac(screen: THREE.Texture) {
  const W = 5.2, H = 3.4, D = 0.2, STAND = 1.15, g = new THREE.Group();
  const alu = metal('silver');
  const disp = new THREE.Group(); disp.position.set(0, STAND + H / 2, 0); disp.rotation.x = -0.035; g.add(disp);
  disp.add(slab(W, H, D, 0.12, alu, 0.025));
  const zf = D / 2 + 0.03;
  const bz = flat(W - 0.1, H - 0.1, 0.09, glass()); bz.position.z = zf; disp.add(bz);
  const sW = W - 0.3, sH = sW / 1.6; const sc = screenPlane(screen, sW, sH, 0.05); sc.position.set(0, 0, zf + 0.002); disp.add(sc);
  // stand arm with oval cut-out
  const arm = new THREE.Shape(); const aw = 0.9, ah = 2.0, ar = 0.07; const x = -aw / 2, y = -ah / 2;
  arm.moveTo(x + ar, y); arm.lineTo(x + aw - ar, y); arm.absarc(x + aw - ar, y + ar, ar, -Math.PI / 2, 0, false); arm.lineTo(x + aw, y + ah - ar); arm.absarc(x + aw - ar, y + ah - ar, ar, 0, Math.PI / 2, false);
  arm.lineTo(x + ar, y + ah); arm.absarc(x + ar, y + ah - ar, ar, Math.PI / 2, Math.PI, false); arm.lineTo(x, y + ar); arm.absarc(x + ar, y + ar, ar, Math.PI, Math.PI * 1.5, false);
  const hole = new THREE.Path(); hole.absellipse(0, -0.12, 0.2, 0.34, 0, Math.PI * 2, false, 0); arm.holes.push(hole);
  const ag = new THREE.ExtrudeGeometry(arm, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 5, curveSegments: 32 });
  const am = new THREE.Mesh(ag, new THREE.MeshPhysicalMaterial({ color: 0x9fa3a8, metalness: 1, roughness: 0.3, clearcoat: 0.15 })); am.castShadow = true; am.position.set(0, ah / 2 + 0.05, -D / 2 - 0.2); am.rotation.x = -0.05; g.add(am);
  const foot = slab(2.3, 1.15, 0.07, 0.1, new THREE.MeshPhysicalMaterial({ color: 0xaeb2b7, metalness: 1, roughness: 0.28 }), 0.02); foot.rotation.x = -Math.PI / 2; foot.position.set(0, 0.045, -D / 2 - 0.08); g.add(foot);
  return g;
}
