// Browser checks for the marketing site: pages render, no outdated prices, nav works on phone, the enquiry form validates, stores and reports failure honestly.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3200';
const res = []; const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const PAGES = ['/', '/platform', '/storefronts', '/payments', '/pricing', '/integrations', '/start', '/contact', '/legal', '/legal/terms'];
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
    if (name === 'phone') { await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Open menu' }).click(); await p.locator('#hd-menu').getByRole('link', { name: 'Pricing', exact: true }).click(); await p.waitForURL('**/pricing'); await p.waitForTimeout(400); ok('[phone] menu opens and navigates', (await p.locator('#hd-menu').isHidden())); }
    // the working demo on the home page
    await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Chalk' }).click(); await p.getByRole('button', { name: 'Add to bag' }).click(); await p.getByRole('button', { name: /^Pay/ }).click();
    ok(`[${name}] demo: paying creates an order in the dashboard cards`, (await p.locator('.fc-order').innerText()).includes('#1043') && (await p.locator('.fc-order').innerText()).includes('chalk'));
    await p.getByRole('button', { name: 'Mark as fulfilled' }).click(); const rc = await p.locator('.scene .rcpt').innerText();
    ok(`[${name}] demo: receipt shows £24.00 paid, £0.68 cost, £23.32 received`, rc.includes('£24.00') && rc.includes('£0.68') && rc.includes('£23.32'), rc.replace(/\n/g, ' '));
    await p.getByRole('button', { name: 'Start again' }).click(); ok(`[${name}] demo: Start again resets it`, (await p.getByRole('button', { name: 'Add to bag' }).count()) === 1);
    await p.goto(BASE + '/pricing'); await p.getByLabel('Order value').fill('100'); await p.getByText('International cards', { exact: true }).first().click();
    ok(`[${name}] calculator: £100 on an international card costs £3.85`, (await p.locator('.rcpt.big').innerText()).includes('£3.85') && (await p.locator('.rcpt.big').innerText()).includes('£96.15'));
    await p.getByLabel('Order value').fill('abc'); ok(`[${name}] calculator: nonsense is refused with a reason`, (await p.getByText('Enter an amount between').count()) === 1);
    // sign-up flow
    const cont = () => p.getByRole('button', { name: /Continue|Send to the team/ });
    await p.goto(BASE + '/start'); await cont().click();
    ok(`[${name}] sign-up: step 1 will not continue without a name and email`, (await p.getByText('Enter your name.').count()) === 1 && (await p.getByText('Enter a valid email address.').count()) === 1 && (await p.getByLabel('Business name').count()) === 0);
    await p.getByLabel('Your name').fill('Check Runner'); await p.getByLabel('Email').fill(`check+${name}@example.com`); await cont().click();
    await cont().click(); ok(`[${name}] sign-up: step 2 needs a business name`, (await p.getByText('Enter your business name.').count()) === 1);
    await p.getByLabel('Business name').fill('Check Shop'); await p.getByText('On my own website').click(); await cont().click();
    await p.getByRole('button', { name: 'Back' }).click(); ok(`[${name}] sign-up: Back keeps what was entered`, (await p.getByLabel('Business name').inputValue()) === 'Check Shop'); await cont().click();
    await p.getByText('11 to 50').click(); await cont().click(); await p.getByText(/That is everything we need/).waitFor({ timeout: 8000 }).catch(() => {});
    ok(`[${name}] sign-up: finished enquiry is confirmed with a reference`, /reference is [0-9a-f]{8}/.test(await p.locator('main').innerText()));
    await p.route('**/api/enquiry', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"code":"store_failed"}' }));
    await p.goto(BASE + '/start'); await p.getByLabel('Your name').fill('Check Runner'); await p.getByLabel('Email').fill('x@example.com'); await cont().click(); await p.getByLabel('Business name').fill('Check Shop'); await cont().click(); await cont().click();
    await p.getByText(/could not save your details/).waitFor({ timeout: 5000 }).catch(() => {});
    const mt = await p.locator('main').innerText(); ok(`[${name}] sign-up: a storage failure is reported, never shown as success`, /could not save your details/.test(mt) && !/everything we need/.test(mt) && (await p.locator('main a[href^="https://wa.me/"]').count()) > 0);
    await p.unroute('**/api/enquiry'); await p.goto(BASE + '/');
    ok(`[${name}] WhatsApp link points at the published number`, (await p.locator('a.wa').first().getAttribute('href')) === 'https://wa.me/447732420976');
    ok(`[${name}] brand reads OneSimpleCommerce, not the old name`, !/OSS Commerce/.test(await p.locator('body').innerText()) && (await p.locator('.hd .wm').getAttribute('aria-label')) === 'OneSimpleCommerce');
    ok(`[${name}] no console or page errors`, errs.filter(e => !/503|404/.test(e)).length === 0, errs.slice(0, 2).join(' / '));
    await c.close();
  }
  await b.close(); const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
})();
