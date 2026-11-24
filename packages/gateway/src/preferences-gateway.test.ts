import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createPreferencesGateway } from './preferences-gateway.ts';

const secret = 'p'.repeat(43); const hash = createHash('sha256').update(secret).digest('hex');
const world = () => {
  const reads: string[] = [];
  const handle = createPreferencesGateway({
    registry: { resolve: async h => h.toString('hex') === hash ? { storefrontId: 'sf_a', storeId: 'store_a', env: 'production', liveOrders: true, cellId: 'cell_a', configVersion: 4 } : null },
    preferences: { get: async sf => { reads.push(sf); return { configVersion: 4, guestCheckout: true, askMarketingConsent: true, showSoldOut: false, checkoutPaused: false }; } },
    rateLimit: { take: () => true }, audit: { record: () => undefined },
  });
  return { handle, reads };
};

test('preferences are credential-bound, contain only public flags and support ETags', async () => {
  const w = world(); const headers = { authorization: `Bearer ${secret}`, 'oss-storefront': 'sf_a' };
  const first = await w.handle({ headers }); assert.equal(first.status, 200); assert.deepEqual(JSON.parse(first.body), { configVersion: 4, guestCheckout: true, askMarketingConsent: true, showSoldOut: false, checkoutPaused: false });
  assert.equal((await w.handle({ headers: { ...headers, 'if-none-match': first.headers.etag } })).status, 304);
  assert.equal((await w.handle({ headers: { ...headers, 'oss-storefront': 'sf_b' } })).status, 403);
  assert.equal(w.reads.length, 2);
});
