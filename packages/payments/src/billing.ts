import Stripe from 'stripe';
import { STRIPE_API_VERSION } from './accounts.ts';

export interface PlatformInvoice {
  id: string; number: string; description: string; created: number; amountMinor: number;
  currency: string; status: 'paid' | 'due' | 'overdue'; url?: string;
}
export interface PlatformBillingSnapshot { status: 'not_started' | 'active' | 'past_due'; nextInvoiceAt?: number; invoices: PlatformInvoice[] }
export interface BillingPort {
  read(customerId: string, subscriptionId?: string): Promise<PlatformBillingSnapshot>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
}

export function invoiceStatus(invoice: { status: string | null; due_date?: number | null; amount_remaining: number }, now = Math.floor(Date.now() / 1000)): 'paid' | 'due' | 'overdue' | null {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.status === 'void' || invoice.status === 'draft') return null;
  if (invoice.status === 'uncollectible') return 'overdue';
  if (invoice.status === 'open') return invoice.amount_remaining > 0 && !!invoice.due_date && invoice.due_date < now ? 'overdue' : 'due';
  return null;
}

export function liveBilling(secretKey: string, stripeOverride?: Stripe): BillingPort {
  const stripe = stripeOverride ?? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION as any });
  return { async read(customerId, subscriptionId) {
    const [subscription, listed] = await Promise.all([
      subscriptionId ? stripe.subscriptions.retrieve(subscriptionId) : Promise.resolve(null),
      stripe.invoices.list({ customer: customerId, limit: 24 }),
    ]);
    if (subscription && (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id) !== customerId) throw new Error('Billing subscription does not belong to this customer.');
    const status = subscription ? ['past_due','unpaid'].includes(subscription.status) ? 'past_due' : ['active','trialing'].includes(subscription.status) ? 'active' : 'not_started' : 'not_started';
    const periods = subscription?.items.data.map(item => item.current_period_end).filter(Number.isFinite) ?? [];
    const invoices = listed.data.flatMap(invoice => {
      const mapped = invoiceStatus(invoice); if (!mapped) return [];
      if (invoice.currency.toLowerCase() !== 'gbp') throw new Error('Billing invoice currency is not GBP.');
      const url = invoice.hosted_invoice_url && /^https:\/\//.test(invoice.hosted_invoice_url) ? invoice.hosted_invoice_url : undefined;
      return [{ id: invoice.id, number: invoice.number ?? invoice.id, description: invoice.lines.data[0]?.description ?? 'OneSimpleCommerce', created: invoice.created, amountMinor: invoice.amount_due, currency: invoice.currency, status: mapped, ...(url ? { url } : {}) }];
    });
    return { status, ...(periods.length ? { nextInvoiceAt: Math.min(...periods) } : {}), invoices };
  }, async createPortalSession(customerId, returnUrl) {
    if (!/^cus_[A-Za-z0-9_]+$/.test(customerId) || !/^https:\/\/[^/]+(?:\/.*)?$/.test(returnUrl)) throw new Error('Invalid billing portal request.');
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    if (!/^https:\/\//.test(session.url)) throw new Error('Stripe returned an invalid billing portal URL.');
    return { url: session.url };
  } };
}
