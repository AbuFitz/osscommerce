import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultHomepage, homepageView, parseHomepageBody, safeContentLink, validateSectionFields } from './homepage-content.ts';

test('new stores receive a factual editable homepage and every section is initially unpublished', () => {
  const view = homepageView([], 'North Star Goods', 'https://shop.example');
  assert.equal(view.sections[0].fields.text, 'Welcome to North Star Goods');
  assert.ok(view.sections.every(section => section.changed)); assert.equal(view.publishedAt, ''); assert.equal(view.previewUrl, 'https://shop.example');
});

test('drafts are compared with the latest published revision section by section', () => {
  const published = defaultHomepage('North Star Goods'); const draft = structuredClone(published); draft.sections[1].fields.headline = 'A new headline';
  const view = homepageView([
    { revision: 2, body: draft, published_at: null },
    { revision: 1, body: published, published_at: '2026-11-24T10:00:00Z' },
  ], 'North Star Goods');
  assert.equal(view.sections.find(section => section.id === 'hero')?.changed, true);
  assert.equal(view.sections.find(section => section.id === 'announcement')?.changed, false);
  assert.equal(view.versions.length, 1);
});

test('homepage validation rejects unsafe links, unknown fields and malformed stored bodies', () => {
  assert.equal(safeContentLink('/collections/all'), true); assert.equal(safeContentLink('//attacker.example'), false); assert.equal(safeContentLink('javascript:alert(1)'), false);
  assert.equal(validateSectionFields('hero', { headline: 'Hello', buttonLink: '//attacker.example' }).ok, false);
  assert.equal(validateSectionFields('hero', { headline: 'Hello', mystery: 'x' }).ok, false);
  assert.throws(() => parseHomepageBody({ sections: [{ id: '../bad', type: 'hero', label: 'Hero', fields: { headline: 'Hi' } }] }), /invalid/);
});
