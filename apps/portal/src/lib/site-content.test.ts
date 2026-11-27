import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMenu, menusFromRows, validatePage, slugify, pagesFromRows } from './site-content';

test('menus: names and links are checked, and a link can only go somewhere safe', () => {
  assert.deepEqual(validateMenu('header', [{ label: ' Shop ', link: '/collections/all' }, { label: 'Journal', link: 'https://example.com/blog' }]), { ok: true, key: 'header', items: [{ label: 'Shop', link: '/collections/all' }, { label: 'Journal', link: 'https://example.com/blog' }] });
  for (const [items, re] of [[[{ label: '', link: '/a' }], /needs a name/], [[{ label: 'x', link: '' }], /somewhere to go/], [[{ label: 'x'.repeat(31), link: '/a' }], /under 30/], [[{ label: 'x', link: 'javascript:alert(1)' }], /https/], [[{ label: 'x', link: '//evil.com' }], /https/], [[{ label: 'x', link: 'http://insecure.test' }], /https/], [Array(13).fill({ label: 'x', link: '/a' }), /up to 12/]] as const) assert.match((validateMenu('header', items as any) as any).message, re as RegExp);
  assert.match((validateMenu('sidebar', []) as any).message, /does not exist/); assert.equal(validateMenu('footer', []).ok, true, 'an empty menu is allowed');
});
test('menus read back with their state', () => {
  const rows = [{ entry: 'menu/header', body: { items: [{ label: 'Shop', link: '/a' }, { nope: 1 }] }, published_at: '2026-11-01T00:00:00Z' }];
  const [h, f] = menusFromRows(rows); assert.deepEqual(h.items, [{ label: 'Shop', link: '/a' }]); assert.equal(h.status, 'published'); assert.equal(f.status, 'not_set_up');
});
test('pages: address, reserved words and content are checked; the body is cleaned', () => {
  const ok = validatePage({ slug: 'our-story', title: 'Our story', body: '<p>Hello <script>x()</script><strong>there</strong></p>', seoDescription: ' About us ' }, true); assert.ok(ok.ok); assert.equal((ok as any).page.body, '<p>Hello <strong>there</strong></p>'); assert.equal((ok as any).page.seoDescription, 'About us');
  assert.match((validatePage({ slug: 'privacy', title: 'x', body: '<p>a</p>' }, true) as any).message, /already/); assert.match((validatePage({ slug: 'Bad Slug', title: 'x', body: 'a' }, false) as any).message, /lowercase/); assert.match((validatePage({ slug: '-x-', title: 'x', body: 'a' }, false) as any).message, /lowercase/);
  assert.match((validatePage({ slug: 'a', title: ' ', body: 'a' }, false) as any).message, /title/); assert.match((validatePage({ slug: 'a', title: 'x', body: '<script>x</script>' }, true) as any).message, /Write something/); assert.equal(validatePage({ slug: 'a', title: 'x', body: '' }, false).ok, true, 'a draft may be empty');
  assert.match((validatePage({ slug: 'a', title: 'x', body: 'a', seoDescription: 'y'.repeat(161) }, false) as any).message, /160/);
});
test('slugs from titles, and deleted pages drop out', () => {
  assert.equal(slugify('Our Story & Café!'), 'our-story-and-cafe'); assert.equal(slugify('  --Hello  World--  '), 'hello-world');
  const pages = pagesFromRows([{ entry: 'site/zeta', body: { title: 'Zeta', body: '<p>z</p>' }, created_at: '2026-11-01T00:00:00Z' }, { entry: 'site/alpha', body: { title: 'Alpha', body: '<p>a</p>' }, published_at: '2026-11-02T00:00:00Z' }, { entry: 'site/gone', body: { deleted: true }, created_at: '2026-11-03T00:00:00Z' }]);
  assert.deepEqual(pages.map(p => [p.slug, p.status]), [['alpha', 'published'], ['zeta', 'draft']]);
});
