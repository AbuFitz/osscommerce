import assert from 'node:assert/strict';
import test from 'node:test';
import { automationOutcome, isRecentAuthentication, paymentView, stripeOnboardingConfig } from './control-plane-mapping.ts';

test('payment view fails closed when no account exists or a stored status is unknown', () => {
  const none = paymentView(undefined, 50);
  assert.equal(none.status, 'not_started');
  assert.equal(none.checkoutAllowed, false);
  const bad = paymentView({ status: 'surprise', charges_enabled: true, payouts_enabled: true, requirements: {} }, 75);
  assert.equal(bad.status, 'unknown');
  assert.equal(bad.checkoutAllowed, false);
  assert.equal(bad.applicationFeeBp, 75);
});

test('payment view preserves provider-derived guidance without trusting malformed lists', () => {
  const view = paymentView({
    status: 'action_required', charges_enabled: true, payouts_enabled: false, stripe_account_id: 'acct_safe',
    requirements: { headline: 'Documents needed', detail: 'Upload proof of address.', due: ['business_profile.url', 4], pending: ['identity'], deadline: '2027-01-01T00:00:00.000Z' },
  }, 50);
  assert.deepEqual(view.due, ['business_profile.url']);
  assert.deepEqual(view.pending, ['identity']);
  assert.equal(view.checkoutAllowed, true);
  assert.equal(view.actionRequired, true);
  assert.equal(view.headline, 'Documents needed');
  assert.equal(view.account, 'acct_safe');
});

test('automation outcomes distinguish consent skips and retries', () => {
  assert.equal(automationOutcome({ status: 'sent' }), 'sent');
  assert.equal(automationOutcome({ status: 'skipped', skip_reason: 'no_consent' }), 'skipped_no_consent');
  assert.equal(automationOutcome({ status: 'failed_retrying' }), 'failed_retrying');
  assert.equal(automationOutcome({ status: 'failed' }), 'failed');
});

test('payment onboarding requires a recent sign-in, correctly scoped key and canonical HTTPS origin', () => {
  const now = Date.UTC(2027, 0, 1);
  assert.equal(isRecentAuthentication(now / 1000 - 599, now), true);
  assert.equal(isRecentAuthentication(now / 1000 - 601, now), false);
  assert.equal(isRecentAuthentication(now / 1000 + 1, now), false);
  assert.equal(stripeOnboardingConfig({ secret: `sk_test_${'a'.repeat(24)}`, appEnv: 'staging', publicUrl: 'https://portal.example/' })?.publicBaseUrl, 'https://portal.example');
  assert.equal(stripeOnboardingConfig({ secret: `sk_test_${'a'.repeat(24)}`, appEnv: 'production', publicUrl: 'https://portal.example' }), null);
  assert.equal(stripeOnboardingConfig({ secret: `sk_live_${'a'.repeat(24)}`, appEnv: 'production', publicUrl: 'http://portal.example' }), null);
  assert.equal(stripeOnboardingConfig({ secret: 'sk_live_placeholder_placeholder', appEnv: 'production', publicUrl: 'https://portal.example' }), null);
});
