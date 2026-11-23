import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnsubscribeToken, parseUnsubscribeToken } from './unsubscribe.ts';

const secret = 'ab'.repeat(32);
test('unsubscribe tokens are opaque, authenticated and round trip a normalised address', () => {
  const token = createUnsubscribeToken(secret, 'store_a', 'Maya@Example.com');
  assert.doesNotMatch(token, /store_a|Maya|Example/); assert.deepEqual(parseUnsubscribeToken(secret, token), { storeId: 'store_a', email: 'maya@example.com' });
  assert.notEqual(createUnsubscribeToken(secret, 'store_a', 'Maya@Example.com'), token);
  const changed = `${token.startsWith('a') ? 'b' : 'a'}${token.slice(1)}`; assert.equal(parseUnsubscribeToken(secret, changed), null);
  assert.equal(parseUnsubscribeToken('cd'.repeat(32), token), null);
});
test('unsubscribe secret must be a full 256-bit hex key', () => assert.throws(() => createUnsubscribeToken('short', 's', 'a@b.test'), /32 random bytes/));
