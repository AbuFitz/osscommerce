import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, TEMPLATES, SAMPLE_ORDER, type Brand } from './index.tsx';

const brand: Brand = { shopName: 'Kiln & Thread', accent: '#2c3a15', supportEmail: 'hello@kilnandthread.example' };

test('every template renders html and text with no unresolved placeholders', async () => {
  for (const t of TEMPLATES) { const r = await renderTemplate(t.id, brand, SAMPLE_ORDER); assert.ok(r.html.length > 500, t.id); assert.ok(r.subject.length > 3, t.id); assert.ok(!/undefined|\{\{|\[object/.test(r.html + r.text), `${t.id} has unresolved content`); }
});
test('order confirmation carries the essential transactional data', async () => {
  const r = await renderTemplate('order_confirmation', brand, SAMPLE_ORDER);
  for (const s of ['#1043', '£74.95', 'VAT included', 'Stoneware mug', '12 Mill Lane']) assert.ok(r.html.includes(s) || r.text.includes(s), s);
});
test('no logo means no image: the shop name is set in type', async () => { const r = await renderTemplate('order_confirmation', brand, SAMPLE_ORDER); assert.ok(!r.html.includes('<img')); assert.ok(r.html.includes('Kiln &amp; Thread') || r.html.includes('Kiln & Thread')); });
test('merchant edits apply to subject and intro but cannot remove order data', async () => {
  const r = await renderTemplate('order_confirmation', brand, SAMPLE_ORDER, { subject: 'Thanks!', intro: 'We love you.' });
  assert.equal(r.subject, 'Thanks!'); assert.ok(r.html.includes('We love you.')); assert.ok(r.html.includes('£74.95'));
});
test('transactional email is labelled as not marketing and has no unsubscribe link', async () => { const r = await renderTemplate('order_dispatched', brand, SAMPLE_ORDER); assert.ok(r.text.includes('not marketing')); assert.ok(!/unsubscribe/i.test(r.html)); });
