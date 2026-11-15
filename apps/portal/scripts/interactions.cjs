// Drives the demo portal like a person and checks that every action does what it says, on both desktop and phone sizes.
//   NEXT_PUBLIC_OSS_DEMO=1 npx next start -p 3100 &   then   NODE_PATH=$(npm root -g) node scripts/interactions.cjs
const { chromium } = require('playwright');
const base = process.env.BASE || 'http://localhost:3100';
const results = []; const ok = (n, c, d = '') => { results.push([c ? 'PASS' : 'FAIL', n, d]); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const toast = async p => (await p.locator('[role=status], [role=alert]').allInnerTexts()).join(' | ');

async function run(name, vp) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: vp, acceptDownloads: true }); const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  const go = async path => { await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(250); };
  const dlg = () => p.locator('dialog[open]');
  const S = s => `[${name}] ${s}`;

  // Add product: validation first, then success, then it shows up everywhere it should
  await go('/products'); await p.getByRole('button', { name: 'Add product' }).first().click(); await dlg().getByRole('button', { name: 'Add product' }).click();
  ok(S('add product: empty form shows field errors and stays open'), (await dlg().locator('.ferr').count()) >= 2 && (await dlg().count()) === 1);
  await dlg().getByLabel('Name').fill('Test lamp'); await dlg().getByLabel('Price').fill('45.5'); await dlg().getByLabel('In stock').fill('7'); await dlg().getByRole('radio', { name: 'Publish now' }).click();
  await dlg().getByRole('button', { name: 'Add product' }).click(); await p.waitForTimeout(900);
  ok(S('add product: dialog closes and the list shows it'), (await dlg().count()) === 0 && (await p.getByText('Test lamp').count()) > 0, await toast(p));
  await go('/inventory'); ok(S('add product: appears in inventory with its stock'), (await p.getByText('Test lamp').count()) > 0);
  await go('/products'); await p.getByRole('button', { name: 'Add product' }).first().click(); await dlg().getByLabel('Name').fill('Dup'); await dlg().getByLabel('Price').fill('1'); await dlg().getByLabel('SKU').fill('MUG-SPK'); await dlg().getByRole('button', { name: 'Add product' }).click(); await p.waitForTimeout(700);
  ok(S('add product: a duplicate SKU is refused with a clear message'), /already used/.test(await toast(p)) && (await dlg().count()) === 1); await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok(S('Esc closes a dialog without saving'), (await dlg().count()) === 0);

  // Import CSV
  await p.getByRole('button', { name: 'Import CSV' }).click();
  await p.setInputFiles('dialog[open] input[type=file]', { name: 'p.csv', mimeType: 'text/csv', buffer: Buffer.from('title,price,sku,stock\nImported vase,22.00,VASE-1,4\n,5,X,1\nBad,abc,Y,1\n') });
  await p.waitForTimeout(300); const sum = await dlg().locator('.imp').innerText(); ok(S('import: previews good rows and names the problems before importing'), /1\s*ready/.test(sum.replace(/\n/g, ' ')) && /Line 3/.test(sum) && /Line 4/.test(sum), sum.replace(/\n/g, ' ').slice(0, 90));
  await dlg().getByRole('button', { name: /Import 1 product/ }).click(); await p.waitForTimeout(900); ok(S('import: the good row is added'), (await p.getByText('Imported vase').count()) > 0);

  // Stock
  await go('/inventory'); await p.getByRole('button', { name: 'Adjust stock' }).click(); await dlg().getByLabel('Product').selectOption({ label: /Tea towel set/ }.toString() ? undefined : undefined).catch(() => {});
  await dlg().getByLabel('Product').selectOption({ index: 0 }); const opt = await dlg().getByLabel('Product').inputValue(); await dlg().getByLabel('Quantity').fill('-9999'); await dlg().getByRole('button', { name: 'Save change' }).click(); await p.waitForTimeout(600);
  ok(S('stock: cannot go below zero, says why'), /below zero|reserved/.test(await toast(p))); await dlg().getByLabel('Quantity').fill('5'); await dlg().getByRole('button', { name: 'Save change' }).click(); await p.waitForTimeout(900); ok(S('stock: a valid change saves and closes'), (await dlg().count()) === 0, await toast(p));

  // Discounts
  await go('/discounts'); await p.getByRole('button', { name: 'Create discount' }).click(); await dlg().getByLabel('Code').fill('spring15'); await dlg().getByLabel('Percentage').fill('15'); await dlg().getByRole('button', { name: 'Create discount' }).click(); await p.waitForTimeout(900);
  ok(S('discount: created and listed (code upper-cased)'), (await p.getByText('SPRING15').count()) > 0);
  await p.getByRole('button', { name: 'Create discount' }).click(); await dlg().getByLabel('Code').fill('WELCOME10'); await dlg().getByLabel('Percentage').fill('5'); await dlg().getByRole('button', { name: 'Create discount' }).click(); await p.waitForTimeout(600); ok(S('discount: duplicate code refused'), /already exists/.test(await toast(p))); await p.keyboard.press('Escape');

  // Shipping zones
  await go('/settings/shipping'); await p.getByRole('button', { name: 'Add zone' }).click(); await dlg().getByLabel('Zone name').fill('Ireland'); await dlg().getByLabel('Where it covers').fill('Republic of Ireland'); await dlg().getByLabel('Name', { exact: true }).fill('Tracked, 4 to 7 days'); await dlg().getByLabel('Price').first().fill('9.5'); await dlg().getByRole('button', { name: 'Save zone' }).click(); await p.waitForTimeout(900);
  ok(S('zone: added'), (await p.getByText('Ireland').count()) > 0); await go('/settings/shipping'); await p.getByRole('button', { name: 'Edit' }).last().click(); await dlg().waitFor(); await dlg().getByLabel('Where it covers').fill('Republic of Ireland and Isle of Man'); await dlg().getByRole('button', { name: 'Save zone' }).click(); await p.waitForTimeout(900); ok(S('zone: edit saves'), (await p.getByText('Isle of Man').count()) > 0);

  // Customers export
  await go('/customers'); const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.getByRole('button', { name: 'Export' }).click()]);
  if (dl) { const body = require('fs').readFileSync(await dl.path(), 'utf8'); ok(S('export: downloads a CSV with consent column'), /Name,Email,Orders,Total spent \(GBP\),Last order,Marketing consent/.test(body) && body.split('\r\n').length > 5, dl.suggestedFilename()); } else ok(S('export: downloads a CSV'), false, 'no download');

  // Storefront
  await go('/storefront'); await p.getByRole('button', { name: /Request launch/ }).click(); ok(S('launch: blocked with the reasons while checklist items are open'), /Not ready to launch/.test(await dlg().innerText()) && (await dlg().locator('.blockers li').count()) > 0); await p.keyboard.press('Escape');
  for (let i = 0; i < 3; i++) { await p.getByRole('button', { name: 'Check domain' }).click(); await p.waitForTimeout(700); if (i === 0) ok(S('domain: not found yet shows the DNS record to add'), (await p.locator('.dns').count()) === 1); }
  ok(S('domain: verifies after the record appears'), /verified/i.test(await toast(p)) || (await p.locator('.dns').count()) === 0);
  await p.getByRole('button', { name: 'Request design change' }).click(); await dlg().getByRole('button', { name: 'Send request' }).click(); ok(S('design change: empty form is refused'), (await dlg().locator('.ferr').count()) === 2); await dlg().getByLabel('What would you like?').fill('Gift wrap'); await dlg().getByLabel('Details').fill('Optional extra at checkout'); await dlg().getByRole('button', { name: 'Send request' }).click(); await p.waitForTimeout(800);
  await go('/support'); ok(S('design change: shows up in support requests'), (await p.getByText('Gift wrap').count()) > 0);

  // Orders
  await go('/orders/o1042'); await p.getByRole('button', { name: 'Mark as fulfilled' }).click(); await dlg().getByRole('button', { name: 'Mark as fulfilled' }).click(); await p.waitForTimeout(1000);
  await go('/orders/o1042'); ok(S('fulfil: order becomes fulfilled and the button goes'), (await p.getByRole('button', { name: 'Mark as fulfilled' }).count()) === 0);
  await go('/orders/o1041'); const rb = p.getByRole('button', { name: /^Refund/ }); if (await rb.count()) { await rb.first().click(); await dlg().getByRole('button', { name: /^Refund/ }).last().click(); await p.waitForTimeout(1000); await go('/orders/o1041'); ok(S('refund: order shows a refund afterwards'), /refund/i.test(await p.locator('main').innerText())); }

  // Team
  await go('/settings/team'); await p.getByRole('button', { name: 'Invite member' }).click(); await dlg().getByRole('button', { name: 'Send invitation' }).click(); ok(S('invite: empty email is refused with a reason'), (await dlg().locator('.ferr').count()) === 1); await dlg().getByLabel('Email').fill('new.person@example.com'); await dlg().getByRole('button', { name: 'Send invitation' }).click(); await p.waitForTimeout(900); await go('/settings/team'); ok(S('invite: person appears as invited'), (await p.getByText('new.person@example.com').count()) > 0);
  const ap = p.getByRole('button', { name: 'Approve' }); if (await ap.count()) { await ap.first().click(); await p.waitForTimeout(900); await go('/settings/team'); ok(S('grant: approving moves it to active'), (await p.getByText('Needs your approval').count()) === 0); }

  ok(S('no uncaught errors or console errors during the run'), errors.length === 0, errors.slice(0, 2).join(' / '));
  await b.close();
}
(async () => { await run('desktop', { width: 1360, height: 900 }); await run('phone', { width: 390, height: 844 }); const f = results.filter(r => r[0] === 'FAIL'); console.log(`\n${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0); })();
