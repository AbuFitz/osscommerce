import assert from 'node:assert/strict';
import test from 'node:test';
import { isUuid, serviceRequestView, validateServiceRequest } from './service-requests.ts';

test('service requests map persisted quote state without inventing optional values', () => {
  const row = serviceRequestView({ id: 'r1', kind: 'design_change', title: 'New landing page', detail: 'A calmer hero', status: 'quoted', quote_minor: 12500, created_at: '2026-11-24T10:00:00Z' });
  assert.deepEqual(row, { id: 'r1', kind: 'design_change', title: 'New landing page', detail: 'A calmer hero', status: 'quoted', quoteMinor: 12500, createdAt: '2026-11-24T10:00:00.000Z' });
  assert.equal(serviceRequestView({ ...row, created_at: row.createdAt, quote_minor: null }).quoteMinor, undefined);
});

test('service request input is trimmed, bounded and quote IDs must be UUIDs', () => {
  assert.deepEqual(validateServiceRequest('  Add products  ', '  Forty new SKUs  '), { title: 'Add products', detail: 'Forty new SKUs' });
  assert.match(validateServiceRequest('x', '').error ?? '', /4–160/);
  assert.match(validateServiceRequest('Valid title', 'x'.repeat(5001)).error ?? '', /5,000/);
  assert.equal(isUuid('2cf5e5c8-57fa-4cb4-9b6c-7f517d163d68'), true);
  assert.equal(isUuid('not-an-id'), false);
});
