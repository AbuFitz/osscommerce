import Stripe from 'stripe';
const s: any = new Stripe('sk_test_proxy-injected', { httpClient: Stripe.createFetchHttpClient() as any });
try {
  const a = await s.v2.core.accounts.create({
    contact_email: 'proof-a@example.com', display_name: 'OSS proof merchant A', dashboard: 'none',
    identity: { country: 'gb', entity_type: 'individual', individual: { given_name: 'Jenny', surname: 'Rosen', date_of_birth: { day: 1, month: 1, year: 1901 } },
      attestations: { terms_of_service: { account: { date: new Date().toISOString(), ip: '203.0.113.10' } } } },
    configuration: { merchant: { mcc: '5734', capabilities: { card_payments: { requested: true } } } },
    defaults: { currency: 'gbp', locales: ['en-GB'], profile: { business_url: 'https://accessible.stripe.com', product_description: 'Homeware' }, responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe', requirements_collector: 'application' } },
    metadata: { oss_proof: 'a' }, include: ['configuration.merchant', 'requirements', 'defaults'],
  }, { idempotencyKey: 'oss-proof-v2app-a-1' });
  console.log(a.id, a.configuration.merchant.capabilities.card_payments.status); for (const e of a.requirements?.entries ?? []) console.log(e.awaiting_action_from, e.description);
} catch (e: any) { console.log('ERR', e.code, e.message?.slice(0, 500)); }
