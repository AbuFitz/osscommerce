import assert from 'node:assert/strict';
import test from 'node:test';
import { legalPagesFromRows, validateLegalBody } from './legal-content.ts';

test('legal revisions map latest draft/published state and retain guided templates', () => {
  const pages = legalPagesFromRows([{ entry: 'legal/privacy', body: { body: 'Real privacy text' }, published_at: '2026-11-24T10:00:00Z', created_at: '2026-11-24T09:00:00Z' }, { entry: 'legal/terms', body: { body: 'Draft terms' }, published_at: null, created_at: '2026-11-24T11:00:00Z' }]);
  assert.equal(pages.find(p => p.slug === 'privacy')?.status, 'published'); assert.equal(pages.find(p => p.slug === 'privacy')?.body, 'Real privacy text');
  assert.equal(pages.find(p => p.slug === 'terms')?.status, 'draft'); assert.equal(pages.find(p => p.slug === 'shipping')?.status, 'not_set_up'); assert.match(pages.find(p => p.slug === 'shipping')?.body ?? '', /delivery times/i);
});

test('legal publishing refuses unknown pages, empty text, oversized text and unresolved placeholders', () => {
  assert.equal(validateLegalBody('privacy', 'Completed policy', true).ok, true);
  assert.match((validateLegalBody('unknown', 'text', false) as any).message, /does not exist/); assert.match((validateLegalBody('terms', '', false) as any).message, /policy text/);
  assert.match((validateLegalBody('terms', 'x'.repeat(20_001), false) as any).message, /20,000/); assert.match((validateLegalBody('privacy', 'Contact {{support email}}', true) as any).message, /Replace/);
});
