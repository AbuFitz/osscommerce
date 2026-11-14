// Needs: playwright with a Chromium install (global is fine: NODE_PATH=$(npm root -g)).
// Renders storefront concept imagery: honest 3D studio renders, not photography. Usage: node scripts/render-sets.mjs
const { build } = require('esbuild'); const { chromium } = require('playwright'); const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const here = __dirname; const out = path.join(here, '../public/renders'); fs.mkdirSync(out, { recursive: true });
(async () => {
const r = await build({ entryPoints: [path.join(here, 'render-sets.entry.ts')], bundle: true, write: false, format: 'iife', minify: true, platform: 'browser' });
const js = r.outputFiles[0].text;
const srv = http.createServer((q, s) => { if (q.url === '/b.js') { s.writeHead(200, { 'content-type': 'text/javascript' }); s.end(js); } else { s.writeHead(200, { 'content-type': 'text/html' }); s.end('<!doctype html><body><script src="/b.js"></script>'); } }).listen(8778);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); p.on('pageerror', e => console.log('pageerror', e.message)); await p.goto('http://localhost:8778/');
for (const name of ['ceramics', 'apothecary', 'coffee', 'audio', 'stationery']) {
  const url = await p.evaluate(n => window.renderSet(n, 1600, 1200), name);
  fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); console.log('rendered', name);
}
await b.close(); srv.close();

})();
