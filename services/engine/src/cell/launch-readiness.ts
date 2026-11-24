import type { AssetEnv } from './assets.ts';

export interface LaunchChecks {
  objectStorage: boolean;
  stripeSecret: boolean;
  stripeWebhook: boolean;
  stripeAccount: boolean;
  stripePublishable: boolean;
}

const looksReal = (value: string | undefined, prefix: string, minimumLength: number) => {
  if (!value?.startsWith(prefix) || value.length < minimumLength) return false;
  return !/(?:placeholder|change[-_ ]?me|replace|example|dummy|fake|todo|test_proxy|_abc)/i.test(value);
};

/**
 * A deliberately conservative, secret-free launch signal. This does not call Stripe or R2;
 * it prevents an operator from mistaking syntactically accepted placeholders for a live-ready
 * cell. The deployment proof still exercises both providers before traffic is enabled.
 */
export function launchChecks(input: {
  assets: AssetEnv | null;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeConnectedAccountId?: string;
  stripePublishableKey?: string;
}): LaunchChecks {
  return {
    objectStorage: input.assets !== null,
    stripeSecret: looksReal(input.stripeSecretKey, 'sk_', 24) || looksReal(input.stripeSecretKey, 'rk_', 24),
    stripeWebhook: looksReal(input.stripeWebhookSecret, 'whsec_', 24),
    stripeAccount: looksReal(input.stripeConnectedAccountId, 'acct_', 16),
    stripePublishable: looksReal(input.stripePublishableKey, 'pk_', 24),
  };
}

export const allLaunchChecksPass = (checks: LaunchChecks) => Object.values(checks).every(Boolean);
