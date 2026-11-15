// Checks that content inside buttons, badges, pills, tabs and other framed things is centred, not clipped, and that dropdown arrows sit properly.
const { chromium } = require('playwright'); const base = process.env.BASE || 'http://localhost:3100';
const pages = ['/', '/orders', '/orders/o1042', '/products', '/products/p1', '/inventory', '/customers', '/discounts', '/analytics', '/automations', '/storefront', '/content', '/support', '/settings', '/settings/payments', '/settings/shipping', '/settings/team', '/settings/preferences', '/settings/emails', '/settings/integrations', '/settings/legal', '/more'];
const probe = () => {
  const out = []; const sel = 'button, a.btn, .btn, .iconbtn, .glass, .chips a, .segc a, .seg a, .tabbar a, .tick, .ic, .av, .pill';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6 || !el.offsetParent) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    if (el.matches('.tgl, .kcard, .drop, .icard, .hd-btn, .switch') || el.closest('.rail, .glist, .tabbar a[aria-current]') && !el.matches('.tabbar a')) continue;
    const kids = []; const rg = document.createRange();
    for (const n of el.childNodes) { if (n.nodeType === 3) { if (!n.textContent.trim()) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width) kids.push(q); } else if (n.nodeType === 1) { const k = getComputedStyle(n); if (k.position === 'absolute' || k.display === 'none') continue; const q = n.getBoundingClientRect(); if (q.width && q.height) kids.push(q); } }
    if (!kids.length) continue;
    const L = Math.min(...kids.map(k => k.left)), R = Math.max(...kids.map(k => k.right)), T = Math.min(...kids.map(k => k.top)), B = Math.max(...kids.map(k => k.bottom));
    const dx = (L + R) / 2 - (r.left + r.right) / 2, dy = (T + B) / 2 - (r.top + r.bottom) / 2; const jc = cs.justifyContent, ta = cs.textAlign;
    const leftAligned = /flex-start|start|left/.test(jc) || (!/center/.test(jc) && /left|start/.test(ta) && cs.display !== 'inline-flex' && cs.display !== 'inline-grid' && cs.display !== 'grid');
    const clipped = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' ? 'clipped-x' : '';
    const bad = []; if (Math.abs(dy) > 1.6) bad.push(`dy ${dy.toFixed(1)}`); if (!leftAligned && Math.abs(dx) > 2.2) bad.push(`dx ${dx.toFixed(1)}`); if (clipped) bad.push(clipped); if (L < r.left - 1 || R > r.right + 1) bad.push('overflows frame');
    if (bad.length) out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 2).join('.')} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${bad.join(', ')}`);
  }
  for (const s of document.querySelectorAll('select')) { if (!s.offsetParent) continue; const cs = getComputedStyle(s); out.push(...(cs.appearance === 'none' && /url|gradient/.test(cs.backgroundImage) && parseFloat(cs.paddingRight) >= 30 ? [] : [`select#${s.id || s.name} native or unpadded arrow (appearance ${cs.appearance}, padding-right ${cs.paddingRight})`])); }
  return out;
};
(async () => {
  const b = await chromium.launch(); const all = {};
  for (const [n, vp] of [['desk', { width: 1360, height: 900 }], ['mob', { width: 390, height: 844 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    for (const path of pages) { await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(250); for (const x of await p.evaluate(probe)) (all[`${n} ${x}`] ||= []).push(path); }
    // dialogs
    for (const [path, btn] of [['/products', 'Add product'], ['/inventory', 'Adjust stock'], ['/discounts', 'Create discount'], ['/settings/shipping', 'Add zone'], ['/settings/team', 'Invite member'], ['/storefront', 'Request design change']]) {
      await p.goto(base + path, { waitUntil: 'load' }); await p.getByRole('button', { name: btn }).first().click(); await p.waitForTimeout(450);
      for (const x of await p.evaluate(probe)) (all[`${n} [dialog ${btn}] ${x}`] ||= []).push(path); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    }
  }
  const rows = Object.entries(all); console.log(rows.length ? rows.map(([k, v]) => `${k}   (${[...new Set(v)].length} page${[...new Set(v)].length > 1 ? 's' : ''}: ${[...new Set(v)].slice(0, 3).join(' ')})`).join('\n') : 'no alignment problems found');
  await b.close(); process.exit(rows.length ? 1 : 0);
})();
