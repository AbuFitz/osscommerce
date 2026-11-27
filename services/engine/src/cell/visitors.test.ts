import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPath, dailyHash, deviceOf, sourceOf } from './visitors-pure.ts';

test('paths lose their query, fragment and long ids', () => {
  assert.equal(cleanPath('/products/mug?utm_source=x&email=a@b.c#top'), '/products/mug'); assert.equal(cleanPath('products//mug/'), '/products/mug'); assert.equal(cleanPath(''), '/'); assert.equal(cleanPath('/'), '/');
  assert.equal(cleanPath('/account/orders/3f9a1c2b7d4e'), '/account/orders/:id', 'a long id is not kept'); assert.equal(cleanPath('/' + 'z'.repeat(300)).length, 200);
});
test('where a visit came from, in a word', () => {
  assert.equal(sourceOf(undefined), 'Direct'); assert.equal(sourceOf(''), 'Direct'); assert.equal(sourceOf('not a url'), 'Direct'); assert.equal(sourceOf('https://www.google.co.uk/search?q=mug'), 'Search'); assert.equal(sourceOf('https://duckduckgo.com/'), 'Search');
  assert.equal(sourceOf('https://l.facebook.com/l.php?u=x'), 'Social'); assert.equal(sourceOf('https://www.instagram.com/'), 'Social'); assert.equal(sourceOf('https://blog.example.org/post?id=1'), 'blog.example.org'); assert.equal(sourceOf('https://shop.test/collections', 'shop.test'), 'Direct', 'their own site is Direct');
});
test('device from screen width', () => { assert.deepEqual([deviceOf(390), deviceOf(820), deviceOf(1440), deviceOf(undefined), deviceOf(0)], ['m', 't', 'd', 'd', 'd']); });
test('the daily hash is stable within a day and cannot be linked across days or people', () => {
  const a = dailyHash('secret', '2026-11-27', '203.0.113.5', 'UA'); assert.match(a, /^[0-9a-f]{16}$/); assert.equal(a, dailyHash('secret', '2026-11-27', '203.0.113.5', 'UA'));
  assert.notEqual(a, dailyHash('secret', '2026-11-28', '203.0.113.5', 'UA'), 'a new day, a new hash'); assert.notEqual(a, dailyHash('secret', '2026-11-27', '203.0.113.6', 'UA')); assert.notEqual(a, dailyHash('other', '2026-11-27', '203.0.113.5', 'UA'), 'the secret matters');
  assert.ok(!a.includes('203'), 'the address is not recoverable from it');
});
