import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Studio set: soft environment light, one key light with soft shadows. Shared by the live hero and the offline render script. */
export function studio(renderer: THREE.WebGLRenderer, scene: THREE.Scene, shadow = true) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3.5, 6, 4); key.castShadow = shadow;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 9; key.shadow.blurSamples = 20; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe9d3, 0.9); rim.position.set(4, 2.5, -3); scene.add(rim);
  renderer.shadowMap.enabled = shadow; renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
}

export function floor(color = 0xffffff, opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color, opacity }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}

type P = [number, number][];
/** Catmull-Rom smoothing so curved profiles (vases, bowls, bottles) have no visible facets. Sharp profiles (lids, tins) stay as drawn. */
const smooth = (pts: P): P => { const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', .5); return c.getPoints(pts.length * 10).map(v => [Math.max(0, v.x), v.y] as [number, number]); };
const lathe = (pts: P, mat: THREE.Material, seg = 128, curved = false) => {
  const g = new THREE.LatheGeometry((curved ? smooth(pts) : pts).map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
};
const glaze = (color: number, rough = 0.28, cc = 0.7) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: cc, clearcoatRoughness: 0.2, sheen: 0.2 });
const matte = (color: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

export const vase = (color = 0xc9643b, h = 1.9) => lathe([[0, 0], [.52, 0], [.62, .08], [.72, h * .32], [.62, h * .6], [.3, h * .82], [.26, h * .93], [.34, h], [.28, h], [.2, h * .97], [0, h * .97]], glaze(color), 128, true);
export const bowl = (color = 0xf1ebdd) => lathe([[0, 0], [.42, 0], [.5, .05], [.9, .38], [1.02, .6], [.98, .62], [.86, .45], [.45, .13], [0, .1]], glaze(color, .35, .5), 128, true);
export const bottle = (color = 0x8a5a2b, h = 1.8) => { const g = new THREE.Group();
  g.add(lathe([[0, 0], [.42, 0], [.46, .06], [.46, h * .62], [.4, h * .72], [.16, h * .8], [.16, h * .92], [0, h * .92]], new THREE.MeshPhysicalMaterial({ color, roughness: .08, transmission: .6, thickness: .6, ior: 1.45, clearcoat: 1 }), 128, true));
  const cap = lathe([[0, 0], [.2, 0], [.2, .22], [0, .22]], matte(0x1b1b1b, .5)); cap.position.y = h * .9; g.add(cap); return g; };
export const jar = (color = 0xf4f1ea, lid = 0x1d1d1d, h = 1) => { const g = new THREE.Group();
  g.add(lathe([[0, 0], [.62, 0], [.66, .06], [.66, h], [0, h]], glaze(color, .5, .3)));
  const l = lathe([[0, 0], [.68, 0], [.68, .2], [0, .2]], matte(lid, .45)); l.position.y = h; g.add(l); return g; };
export const tin = (color = 0x1c1c1a, h = 1.3) => lathe([[0, 0], [.7, 0], [.72, .04], [.72, h], [.66, h + .04], [0, h + .04]], new THREE.MeshPhysicalMaterial({ color, roughness: .35, metalness: .6, clearcoat: .4 }));
export const box = (w: number, h: number, d: number, color: number, r = .06, mat?: THREE.Material) => {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 6, curveSegments: 12 });
  g.translate(0, h / 2, -d / 2); const m = new THREE.Mesh(g, mat ?? matte(color, .7)); m.castShadow = true; m.receiveShadow = true; return m; };
export const speaker = (color = 0x232626) => { const g = new THREE.Group(); const b = box(1.5, 2.1, 1.2, color, .3, new THREE.MeshPhysicalMaterial({ color, roughness: .5, clearcoat: .3 })); g.add(b);
  const grille = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .06, 64), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .9 })); grille.rotation.x = Math.PI / 2; grille.position.set(0, 1.05, .62); g.add(grille);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .1, 32), new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: .9, roughness: .25 })); knob.rotation.x = Math.PI / 2; knob.position.set(0, 1.78, .62); g.add(knob); return g; };

export type Set = { bg: [string, string]; build: () => THREE.Group; cam: [number, number, number]; look: [number, number, number] };
const place = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1) => { o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s); return o; };
export const SETS: Record<string, Set> = {
  ceramics: { bg: ['#efe3d2', '#d8c3a5'], cam: [0, 2.2, 7], look: [0, 1, 0], build: () => { const g = new THREE.Group();
    g.add(place(vase(0xc4623a, 2.1), -1.25, 0, -.3)); g.add(place(vase(0xf0e8d8, 1.4), .45, 0, .45)); g.add(place(bowl(0x6f8a6a), 1.75, 0, -.1, 0, .72)); return g; } },
  apothecary: { bg: ['#e7ece6', '#c7d3c9'], cam: [0, 2.2, 6.6], look: [0, 1, 0], build: () => { const g = new THREE.Group();
    g.add(place(bottle(0x9a6a2e, 2.2), -1.2, 0, -.2)); g.add(place(jar(0xf5f2ea, 0x2a2a28, 1.1), .35, 0, .55)); g.add(place(bottle(0xdfe6e0, 1.5), 1.55, 0, -.15)); return g; } },
  coffee: { bg: ['#3a2a20', '#1c1511'], cam: [0, 2.4, 8.2], look: [0, 1, 0], build: () => { const g = new THREE.Group();
    g.add(place(tin(0x1c1c1a, 1.7), -1.35, 0, -.1)); const bag = box(1.5, 2.3, .55, 0xc79b63, .12); bag.rotation.y = .25; g.add(place(bag, .4, 0, .4)); g.add(place(tin(0xb8764a, 1), 1.85, 0, .35, 0, .85)); return g; } },
  audio: { bg: ['#d9e0ea', '#aeb9c9'], cam: [0, 2.4, 8.2], look: [0, 1.05, 0], build: () => { const g = new THREE.Group();
    g.add(place(speaker(0x1d2022), -1, 0, 0, .3)); g.add(place(speaker(0xdfe2e4), 1.15, 0, .25, -.35, .75)); return g; } },
  stationery: { bg: ['#f3ecdc', '#e2d4b8'], cam: [0, 3.4, 7.4], look: [0, .6, 0], build: () => { const g = new THREE.Group();
    const a = box(2.4, .22, 1.7, 0x2f4a3a, .05); const b = box(2.2, .22, 1.6, 0xd9c7a0, .05); const c = box(2.0, .22, 1.5, 0xb4472d, .05);
    g.add(place(a, 0, 0, 0, .12)); g.add(place(b, 0, .26, 0, -.05)); g.add(place(c, 0, .52, 0, .1)); const pen = lathe([[0, 0], [.07, 0], [.07, 1.5], [0, 1.58]], new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: .7, roughness: .3 })); pen.rotation.z = Math.PI / 2; pen.rotation.y = .35; pen.position.set(-.7, .78, 1.15); g.add(pen); return g; } },
};
