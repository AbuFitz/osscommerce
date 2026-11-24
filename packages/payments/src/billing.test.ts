import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceStatus, liveBilling } from './billing.ts';

test('platform billing maps subscription state and customer-owned GBP invoices', async () => {
  assert.equal(invoiceStatus({ status: 'open', due_date: 10, amount_remaining: 100 }, 11), 'overdue'); assert.equal(invoiceStatus({ status: 'void', amount_remaining: 0 }), null);
  let portalInput: any; const stripe: any = { subscriptions: { retrieve: async () => ({ id: 'sub_1', status: 'active', customer: 'cus_1', items: { data: [{ current_period_end: 200 }] } }) }, invoices: { list: async () => ({ data: [{ id: 'in_1', number: 'OSC-1', status: 'paid', due_date: null, amount_remaining: 0, amount_due: 3900, currency: 'gbp', created: 100, hosted_invoice_url: 'https://invoice.stripe.com/i/1', lines: { data: [{ description: 'OneSimpleCommerce, November' }] } }] }) }, billingPortal: { sessions: { create: async (input: any) => { portalInput = input; return { url: 'https://billing.stripe.com/p/session' }; } } } };
  const view = await liveBilling('sk_test_x', stripe).read('cus_1', 'sub_1'); assert.equal(view.status, 'active'); assert.equal(view.nextInvoiceAt, 200); assert.equal(view.invoices[0].amountMinor, 3900);
  stripe.subscriptions.retrieve = async () => ({ status: 'active', customer: 'cus_other', items: { data: [] } }); await assert.rejects(liveBilling('sk_test_x', stripe).read('cus_1', 'sub_1'), /does not belong/);
  const portal = await liveBilling('sk_test_x', stripe).createPortalSession('cus_1', 'https://portal.example/account/billing'); assert.equal(portal.url, 'https://billing.stripe.com/p/session'); assert.deepEqual(portalInput, { customer: 'cus_1', return_url: 'https://portal.example/account/billing' });
  await assert.rejects(liveBilling('sk_test_x', stripe).createPortalSession('bad', 'http://portal.example'), /Invalid/);
});
