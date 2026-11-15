// Contrast audit: every visible text node vs its effective background (translucent layers composited), on key pages and in open popups.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3100';
const PAGES = ['/', '/orders', '/orders/o1042', '/products', '/collections', '/inventory', '/customers', '/discounts', '/analytics', '/analytics/live', '/automations', '/storefront', '/settings', '/settings/payments', '/settings/shipping', '/settings/team', '/settings/integrations', '/support'];
const probe = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); let c = parse(cs.backgroundColor); const gi = cs.backgroundImage; if (gi && gi.includes('gradient')) { const cols = [...gi.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])); if (cols.length) { const a = cols.reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2], s[3] + x[3]], [0, 0, 0, 0]).map(v => v / cols.length); c = a; } } if (c[3] > 0) stack.push(c); if (c[3] === 1) break; } let base = [236, 240, 222, 1]; for (const c of stack.reverse()) base = over(c, base); return base; };
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || el.closest('script,style,svg')) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue; // only what is on screen
    const fg = parse(cs.color); const bg = bgOf(el); const f = over([fg[0], fg[1], fg[2], fg[3] * (+cs.opacity || 1)], bg);
    const L1 = lum(f), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) out.push({ text: t.slice(0, 40), ratio: +ratio.toFixed(2), need, size, cls: (el.className && el.className.toString().slice(0, 30)) || el.tagName });
  }
  return out;
};
(async () => {
  const b = await chromium.launch(); const bad = new Map();
  for (const [name, vp] of [['desktop', { width: 1360, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const c = await b.newContext({ viewport: vp }); await c.addCookies([{ name: 'oss_demo', value: 'live', url: BASE }]); const p = await c.newPage();
    const add = (where, list) => list.forEach(x => { const k = `${x.cls}|${x.text}`; if (!bad.has(k)) bad.set(k, { ...x, where: [] }); bad.get(k).where.push(`${name}:${where}`); });
    for (const u of PAGES) { await p.goto(BASE + u); await p.waitForTimeout(350); add(u, await p.evaluate(probe)); }
    await p.goto(BASE + '/orders'); await p.getByRole('button', { name: /Notifications/ }).first().click(); await p.waitForTimeout(500); add('bell', await p.evaluate(probe));
    await p.keyboard.press('Escape'); await p.goto(BASE + '/products'); await p.getByRole('button', { name: 'Add product' }).first().click(); await p.waitForTimeout(500); add('add-product', await p.evaluate(probe));
    await c.close();
  }
  await b.close(); const rows = [...bad.values()].sort((a, b) => a.ratio - b.ratio);
  rows.slice(0, 40).forEach(r => console.log(`${r.ratio} (need ${r.need}) .${r.cls} "${r.text}"  ${[...new Set(r.where)].slice(0, 3).join(', ')}`));
  console.log(`\n${rows.length} distinct low-contrast text styles`); process.exit(rows.length ? 1 : 0);
})();
