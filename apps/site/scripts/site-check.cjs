// Browser checks for the marketing site: pages render, no outdated prices, nav works on phone, the enquiry form validates, stores and reports failure honestly.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3200';
const res = []; const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const PAGES = ['/', '/platform', '/storefronts', '/payments', '/pricing', '/integrations', '/contact', '/legal', '/legal/terms'];
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const c = await b.newContext({ viewport: vp }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    for (const u of PAGES) {
      const r = await p.goto(BASE + u); await p.waitForTimeout(250); const t = await p.locator('body').innerText();
      ok(`[${name}] ${u} loads with one h1`, r.status() === 200 && (await p.locator('h1').count()) === 1);
      ok(`[${name}] ${u} has no outdated prices or plan names`, !/49\.99|£99\b|£699|1,499|Commerce Plus/.test(t));
      ok(`[${name}] ${u} does not overflow sideways`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
      const fonts = await p.evaluate(() => [getComputedStyle(document.querySelector('h1')).fontFamily, getComputedStyle(document.body).fontFamily]);
      ok(`[${name}] ${u} uses Funnel Display and Hanken Grotesk`, /Funnel Display/.test(fonts[0]) && /Hanken Grotesk/.test(fonts[1]));
      const broken = await p.evaluate(async () => { const out = []; for (const a of [...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href')))]) { const r = await fetch(a, { method: 'GET' }); if (r.status >= 400) out.push(a + ' ' + r.status); } return out; });
      ok(`[${name}] ${u} has no broken internal links`, broken.length === 0, broken.join(', '));
    }
    await p.goto(BASE + '/pricing'); const pt = await p.locator('main').innerText(); ok(`[${name}] pricing shows £479 and £39`, pt.includes('£479') && pt.includes('£39'));
    const nf = await p.goto(BASE + '/nope'); ok(`[${name}] unknown page returns a 404 page`, nf.status() === 404 && (await p.getByText('That page is not here').count()) === 1);
    if (name === 'phone') { await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Open menu' }).click(); await p.locator('#hd-menu').getByRole('link', { name: 'Pricing' }).click(); await p.waitForURL('**/pricing'); await p.waitForTimeout(400); ok('[phone] menu opens and navigates', (await p.locator('#hd-menu').isHidden())); }
    // enquiry form
    await p.goto(BASE + '/contact'); await p.getByRole('button', { name: /Send enquiry/ }).click();
    ok(`[${name}] form: empty submit shows field errors and sends nothing`, (await p.getByText('Enter your name.').count()) === 1 && (await p.getByText('Enter a valid email address.').count()) === 1);
    await p.getByLabel('Your name').fill('Check Runner'); await p.getByLabel('Email').fill(`check+${name}@example.com`); await p.getByLabel('Business name').fill('Check Shop');
    await p.getByLabel('How many products?').selectOption('11-50'); await p.getByRole('button', { name: /Send enquiry/ }).click();
    await p.getByRole('status').waitFor({ timeout: 8000 }).catch(() => {});
    ok(`[${name}] form: valid enquiry is confirmed with a reference`, /We have your enquiry/.test(await p.locator('main').innerText()) && /reference is [0-9a-f]{8}/.test(await p.locator('main').innerText()));
    // failure path: the server says it could not store
    await p.route('**/api/enquiry', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"code":"store_failed"}' }));
    await p.goto(BASE + '/contact'); await p.getByLabel('Your name').fill('Check Runner'); await p.getByLabel('Email').fill('x@example.com'); await p.getByLabel('Business name').fill('Check Shop'); await p.getByRole('button', { name: /Send enquiry/ }).click();
    await p.getByRole('alert').first().waitFor({ timeout: 5000 }).catch(() => {});
    const mt = await p.locator('main').innerText(); ok(`[${name}] form: a storage failure is reported, never shown as success`, /could not save your enquiry/.test(mt) && !/We have your enquiry/.test(mt) && (await p.locator('a[href^="mailto:"]').count()) > 0);
    ok(`[${name}] no console or page errors`, errs.filter(e => !/503|404/.test(e)).length === 0, errs.slice(0, 2).join(' / '));
    await c.close();
  }
  await b.close(); const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
})();
