import { test } from 'node:test'; import assert from 'node:assert/strict';
import { project, faceLng } from './project';
// Values below were measured from cobe's rendered canvas (see the calibration in the live map notes).
test('matches the measured globe render', () => {
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.02, `${a} vs ${b}`);
  let p = project(0, 0, 0, 0); near(p.x, 0.848); near(p.y, 0);
  p = project(0, -60, 0, 0); near(p.x, 0.423);
  p = project(30, -90, 0, 0); near(p.y, -0.427);
  p = project(0, -90, 0, 0.4); near(p.y, 0.329);
  p = project(0, -90, 0.5, 0); near(p.x, 0.406);
  p = project(51.5, -2.6, 0, 0.2); near(p.x, 0.527); near(p.y, -0.649);
  near(project(0, -60, 0, 0, 1.2).x, 0.508); near(project(30, -90, 0, 0, 1.2).y, -0.512);
  assert.ok(project(0, 30, 0, 0).z < 0, 'far side is hidden');
});
test('faceLng brings a place to the middle', () => { const p = project(10, 77, faceLng(77), 0); assert.ok(Math.abs(p.x) < 1e-9 && p.z > 0); });
