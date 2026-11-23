import { renderTemplate, type Brand, type Editable, type OrderData, type TemplateId } from '@oss-commerce/emails';
import { z } from 'zod';
import { PermanentError } from './model.ts';
import type { SendRequest } from './ports.ts';
import type { PreparedEmail } from './resend.ts';

const Template = z.enum(['order_confirmation', 'order_dispatched', 'refund_confirmation', 'payment_failed', 'password_reset', 'merchant_new_order']);
const Payload = z.object({
  orderCode: z.string().min(1).max(80),
  placedAt: z.string().min(1),
  customerName: z.string().min(1).max(200),
  lines: z.array(z.object({ title: z.string().min(1).max(500), quantity: z.number().int().positive(), unitMinor: z.number().int().nonnegative() })).max(250),
  subtotalMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative().optional(),
  vatMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  shipTo: z.string().min(1).max(1000),
  orderUrl: z.string().url(),
  trackingUrl: z.string().url().optional(),
  carrier: z.string().max(200).optional(),
  refundMinor: z.number().int().nonnegative().optional(),
});

export interface CommerceEmailProfile {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  brand: Brand;
  edits?: Partial<Record<TemplateId, Editable>>;
}

const safeName = (value: string) => value.replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

function money(minor: number, currency: string): string {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100); }
  catch { throw new PermanentError(`Unsupported email currency ${currency}`); }
}

/** Converts immutable commerce-event data into the shared React Email templates. No values are invented. */
export function commerceEmailPreparer(profileFor: (storeId: string) => Promise<CommerceEmailProfile | null>) {
  return async (request: SendRequest): Promise<PreparedEmail> => {
    const template = Template.safeParse(request.template);
    if (!template.success) throw new PermanentError(`Unknown email template ${request.template}`);
    const payload = Payload.safeParse(request.data);
    if (!payload.success) throw new PermanentError('Commerce event does not contain a complete email snapshot');
    const profile = await profileFor(request.storeId);
    if (!profile) throw new PermanentError('Store email profile is not configured');
    const fromEmail = z.string().email().safeParse(profile.fromEmail);
    const replyTo = profile.replyTo ? z.string().email().safeParse(profile.replyTo) : null;
    if (!fromEmail.success || (replyTo && !replyTo.success)) throw new PermanentError('Store email sender is invalid');
    const p = payload.data; const m = (n: number) => money(n, p.currency);
    const order: OrderData = {
      number: p.orderCode, placed: p.placedAt, customerName: p.customerName,
      lines: p.lines.map(l => ({ title: l.title, qty: l.quantity, unit: m(l.unitMinor) })),
      subtotal: m(p.subtotalMinor), shipping: m(p.shippingMinor), discount: p.discountMinor ? m(p.discountMinor) : undefined,
      vatIncluded: m(p.vatMinor), total: m(p.totalMinor), shipTo: p.shipTo, orderUrl: p.orderUrl,
      trackingUrl: p.trackingUrl, carrier: p.carrier, refund: p.refundMinor === undefined ? undefined : m(p.refundMinor),
    };
    const rendered = await renderTemplate(template.data, profile.brand, order, profile.edits?.[template.data]);
    return {
      from: `${safeName(profile.fromName || profile.brand.shopName)} <${fromEmail.data}>`,
      replyTo: replyTo?.success ? replyTo.data : undefined,
      subject: rendered.subject, html: rendered.html, text: rendered.text,
    };
  };
}
