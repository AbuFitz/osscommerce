import test from 'node:test';
import assert from 'node:assert/strict';
import { allLaunchChecksPass, launchChecks } from './launch-readiness.ts';

const assets = { endpoint: 'https://r2.example', bucket: 'media', accessKeyId: 'access', secretAccessKey: 'secret' };

test('launch readiness fails closed when providers are absent or placeholders', () => {
  assert.deepEqual(launchChecks({ assets: null }), {
    objectStorage: false,
    stripeSecret: false,
    stripeWebhook: false,
    stripeAccount: false,
    stripePublishable: false,
  });
  assert.equal(allLaunchChecksPass(launchChecks({
    assets,
    stripeSecretKey: 'sk_test_placeholder',
    stripeWebhookSecret: 'whsec_change_me',
    stripeConnectedAccountId: 'acct_abc',
    stripePublishableKey: 'pk_test_example',
  })), false);
});

test('launch readiness reports only booleans for plausibly configured providers', () => {
  const checks = launchChecks({
    assets,
    stripeSecretKey: 'sk_test_51Qwertyuiopasdfghjklzxcvbnm',
    stripeWebhookSecret: 'whsec_qwertyuiopasdfghjklzxcvbnm',
    stripeConnectedAccountId: 'acct_1Qwertyuiopasdf',
    stripePublishableKey: 'pk_test_51Qwertyuiopasdfghjklzxcvbnm',
  });
  assert.equal(allLaunchChecksPass(checks), true);
  assert.deepEqual(Object.values(checks), [true, true, true, true, true]);
});
