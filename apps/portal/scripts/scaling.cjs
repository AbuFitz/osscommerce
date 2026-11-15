// Renders the portal at many window sizes and checks it still fits: no sideways scroll, rail and tab bar fully on screen, nothing hidden behind the header, no clipped primary actions.
const { chromium } = require('playwright'); const base = process.env.BASE || 'http://localhost:3100';
const sizes = [[360, 640], [390, 844], [430, 932], [600, 900], [768, 1024], [820, 1180], [900, 700], [1024, 768], [1100, 700], [1280, 640], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440]];
const pages = ['/', '/orders', '/orders/o1042', '/products', '/inventory', '/settings', '/settings/payments', '/settings/integrations', '/storefront', '/content'];
const probe = () => {
  const problems = []; const W = innerWidth, H = innerHeight;
  if (document.documentElement.scrollWidth > W + 1) problems.push(`sideways scroll (${document.documentElement.scrollWidth - W}px)`);
  const rail = document.querySelector('.rail'); if (rail && rail.offsetParent) {
    const r = rail.getBoundingClientRect(); const scroll = rail.scrollHeight > rail.clientHeight + 1 && getComputedStyle(rail).overflowY !== 'visible';
    if (r.bottom > H + 1 || r.top < -1) problems.push(`rail off screen (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} of ${H})`);
    if (!scroll) for (const el of rail.querySelectorAll('a, button')) { const q = el.getBoundingClientRect(); if (q.width && (q.bottom > r.bottom + 1 || q.top < r.top - 1)) { problems.push(`rail item outside rail: ${(el.dataset.label || el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}`); break; } }
    const items = [...rail.querySelectorAll('a, button')].map(e => e.getBoundingClientRect()).filter(q => q.width); for (let i = 1; i < items.length; i++) if (items[i].top < items[i - 1].bottom - 1 && Math.abs(items[i].left - items[i - 1].left) < 4) { problems.push('rail items overlap'); break; }
    const small = [...rail.querySelectorAll('a, button')].map(e => e.getBoundingClientRect()).filter(q => q.width && q.height < 30); if (small.length) problems.push(`${small.length} rail targets under 30px`);
  }
  const bar = document.querySelector('.tabbar'); if (bar && bar.offsetParent) { const q = bar.getBoundingClientRect(); if (q.bottom > H + 1 || q.left < 0 || q.right > W + 1) problems.push('tab bar off screen'); }
  const top = document.querySelector('.top, .topbar'); for (const h of document.querySelectorAll('main h1')) { const t = [...document.querySelectorAll('.top, .topbar')].find(e => e.offsetParent); if (t && t.getBoundingClientRect().bottom > h.getBoundingClientRect().top + 2 && h.getBoundingClientRect().top >= 0 && scrollY === 0) { problems.push('title tucked under header'); break; } }
  for (const el of document.querySelectorAll('main .btn.primary, main h1')) { const q = el.getBoundingClientRect(); if (q.width && (q.right > W + 1 || q.left < -1)) { problems.push(`cut off at the edge: ${el.textContent.trim().slice(0, 20)}`); break; } }
  const tiny = [...document.querySelectorAll('main p, main span, main li, main td, main dd')].filter(e => e.offsetParent && e.children.length === 0 && e.textContent.trim().length > 2 && parseFloat(getComputedStyle(e).fontSize) < 11.5); if (tiny.length > 0) problems.push(`${tiny.length} text runs under 11.5px`);
  return problems;
};
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const [w, h] of sizes) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); const found = {};
    for (const path of pages) { await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(200); for (const x of await p.evaluate(probe)) (found[x] ||= []).push(path); }
    const rows = Object.entries(found); bad += rows.length; console.log(`${w}x${h}`.padEnd(10), rows.length ? rows.map(([k, v]) => `${k} [${[...new Set(v)].slice(0, 3).join(' ')}${v.length > 3 ? ' +' + (v.length - 3) : ''}]`).join(' | ') : 'ok');
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
