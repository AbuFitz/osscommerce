import * as THREE from 'three';
import { SETS, studio, floor } from '../src/three/objects';
declare global { interface Window { renderSet: (name: string, w: number, h: number) => string } }
window.renderSet = (name, w, h) => {
  const set = SETS[name];
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h, false);
  const scene = new THREE.Scene();
  // backdrop gradient as a canvas texture
  const bg = document.createElement('canvas'); bg.width = 8; bg.height = 512; const c = bg.getContext('2d')!; const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, set.bg[0]); g.addColorStop(1, set.bg[1]); c.fillStyle = g; c.fillRect(0, 0, 8, 512);
  const t = new THREE.CanvasTexture(bg); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  studio(r, scene); scene.add(floor(0x000000, 0.28)); scene.add(set.build());
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 60); cam.position.set(...set.cam); cam.lookAt(...set.look);
  r.render(scene, cam); const url = canvas.toDataURL('image/jpeg', 0.92); r.dispose(); return url;
};
