// Builds src/lib/geo/places.json and public/geo/countries.json from open data.
// Usage: node scripts/build-gazetteer.mjs <dir with cities15000.txt, GB.txt, countryInfo.txt>
// Data: GeoNames (CC BY 4.0, https://www.geonames.org) and Natural Earth via world-atlas (public domain).
import { readFileSync, writeFileSync } from 'node:fs';
import { geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
const dir = process.argv[2]; if (!dir) throw new Error('pass the data directory');
const rows = f => readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const r2 = n => Math.round(n * 100) / 100;
const places = new Map();
const add = (name, cc, lat, lng, pop) => { const k = `${cc}|${norm(name)}`; const old = places.get(k); if (!k.endsWith('|') && (!old || old[4] < pop)) places.set(k, [norm(name), cc, r2(+lat), r2(+lng), pop]); };
for (const c of rows('cities15000.txt')) if (+c[14] >= 100000 || c[8] === 'GB') { add(c[2], c[8], c[4], c[5], +c[14]); add(c[1], c[8], c[4], c[5], +c[14]); }
for (const c of rows('GB.txt')) if (c[6] === 'P' && +c[14] >= 2500) { add(c[2], 'GB', c[4], c[5], +c[14]); add(c[1], 'GB', c[4], c[5], +c[14]); }
const info = rows('countryInfo.txt'); const byNum = new Map(info.map(c => [String(+c[2]), c[0]])); const names = Object.fromEntries(info.map(c => [c[0], c[4]]));
const topo = JSON.parse(readFileSync(new URL('../../../node_modules/world-atlas/countries-110m.json', import.meta.url)));
const fc = feature(topo, topo.objects.countries); const centroids = {};
for (const f of fc.features) { const cc = byNum.get(String(+f.id)); if (cc) { const [lng, lat] = geoCentroid(f); centroids[cc] = [r2(lat), r2(lng)]; } }
// 110m data omits microstates and small islands; use each country's most populous place as its fallback point.
const top = {}; for (const p of places.values()) if (!top[p[1]] || top[p[1]][2] < p[4]) top[p[1]] = [p[2], p[3], p[4]];
for (const cc of Object.keys(names)) if (!centroids[cc] && top[cc]) centroids[cc] = [top[cc][0], top[cc][1]];
centroids.GB = [54.0, -2.5];
writeFileSync(new URL('../src/lib/geo/places.json', import.meta.url), JSON.stringify({ attribution: 'Place names and positions: GeoNames, CC BY 4.0', places: [...places.values()].map(p => p.slice(0, 4)), countries: centroids, names }));
writeFileSync(new URL('../public/geo/countries.json', import.meta.url), JSON.stringify(topo));
console.log(places.size, 'places', Object.keys(centroids).length, 'countries');
