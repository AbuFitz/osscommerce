// End-to-end check of the portal in LIVE mode against a real engine cell (services/engine/proofs/dev-cell.ts): sign-in, real data, real changes, sign-out.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3101'; const USER = process.env.CELL_USER || 'owner@example.com'; const PASS = process.env.CELL_PASS || 'long-random-pass';
const res = []; const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dlg = () => p.locator('dialog[open]');
  await p.goto(BASE + '/orders'); ok('no session: sent to sign-in, no data rendered', p.url().endsWith('/login') && (await p.getByText('Sign in to your store').count()) === 1);
  await p.getByLabel('Email').fill(USER); await p.getByLabel('Password').fill('wrong-password'); await p.getByRole('button', { name: 'Sign in' }).click(); await p.getByRole('alert').filter({ hasText: 'do not match' }).waitFor({ timeout: 8000 }).catch(() => {});
  ok('wrong password: refused with a reason, still signed out', (await p.getByText('do not match').count()) === 1 && p.url().includes('/login'));
  await p.getByLabel('Password').fill(PASS); await p.getByRole('button', { name: 'Sign in' }).click(); await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  ok('right password: signed in to the dashboard', !p.url().includes('/login') && (await p.getByRole('heading', { name: 'Overview' }).count()) === 1);
  const ck = (await c.cookies()).find(k => k.name === 'osc_session'); ok('session cookie is httpOnly', !!ck && ck.httpOnly === true);
  ok('no demo wording or demo switcher in live mode', !/Demo view|Demo figures/.test(await p.locator('body').innerText()));
  await p.goto(BASE + '/orders'); const rows = await p.locator('table.t tbody tr').count(); ok('orders: the engine\'s real paid orders are listed', rows === 2 && (await p.getByText('Maya Lee').count()) >= 1, `${rows} rows`);
  await p.locator('table.t tbody tr a').first().click(); await p.waitForURL('**/orders/*'); const before = await p.locator('main').innerText(); ok('order: real lines, customer and total from the engine', /Test Mug/.test(before) && /Maya Lee/.test(before) && /Watford/.test(before));
  await p.getByRole('button', { name: 'Mark as fulfilled' }).first().click(); await dlg().getByRole('button', { name: 'Mark as fulfilled' }).click(); await p.waitForTimeout(1800); await p.reload();
  ok('fulfil: the engine now reports the order fulfilled', (await p.getByRole('button', { name: 'Mark as fulfilled' }).count()) === 0 && /Fulfilled/.test(await p.locator('main').innerText()));
  await p.goto(BASE + '/products'); ok('products: the engine\'s catalogue is listed', (await p.getByText('Test Mug').count()) >= 1);
  await p.getByRole('button', { name: 'Add product' }).first().click(); await dlg().getByLabel('Name').fill('Live test candle'); await dlg().getByLabel('Price').fill('12.50'); await dlg().getByLabel('SKU').fill('LIVE-CND'); await dlg().getByLabel('In stock').fill('7'); await dlg().getByRole('button', { name: 'Add product' }).click(); await p.waitForTimeout(2000); await p.goto(BASE + '/products');
  ok('add product: created in the engine and listed', (await p.getByText('Live test candle').count()) >= 1);
  await p.goto(BASE + '/inventory'); ok('inventory: stock figures come from the engine', /Live test candle/.test(await p.locator('main').innerText()));
  await p.goto(BASE + '/'); ok('overview: sales computed from engine orders', /£/.test(await p.locator('main').innerText()));
  for (const u of ['/customers', '/collections', '/discounts', '/analytics', '/analytics/live', '/automations', '/storefront', '/content', '/support', '/settings', '/settings/payments', '/settings/shipping', '/settings/team', '/settings/integrations', '/settings/emails', '/settings/legal', '/settings/preferences', '/account/billing', '/more']) { const r = await p.goto(BASE + u); ok(`${u} renders in live mode without fixtures or errors`, r.status() === 200 && !/Application error|Maya Okafor|Kiln & Thread theme/.test(await p.locator('body').innerText())); }
  await p.goto(BASE + '/'); await p.getByRole('button', { name: /Account menu/ }).click(); await p.getByRole('button', { name: 'Sign out' }).click(); await p.waitForURL('**/login');
  await p.goto(BASE + '/orders'); ok('sign out: session gone, pages are closed again', p.url().endsWith('/login'));
  ok('no uncaught page errors', errs.length === 0, errs.slice(0, 2).join(' / '));
  await b.close(); const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
})();
