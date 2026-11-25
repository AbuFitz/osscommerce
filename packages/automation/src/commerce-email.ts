import { renderAccountEmail, renderTemplate, type Brand, type Editable, type OrderData, type TemplateId } from '@oss-commerce/emails';
import { z } from 'zod';
import { PermanentError } from './model.ts';
import type { SendRequest } from './ports.ts';
import type { PreparedEmail } from './resend.ts';

const Template = z.enum(['order_confirmation', 'order_dispatched', 'refund_confirmation', 'payment_failed', 'password_reset', 'merchant_new_order']);
const Payload = z.object({
  orderCode: z.string().min(1).max(80),
  placedAt: z.string().datetime(),
  customerName: z.string().min(1).max(200),
  lines: z.array(z.object({ title: z.string().min(1).max(500), quantity: z.number().int().positive(), unitMinor: z.number().int().nonnegative() })).max(250),
  subtotalMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative().optional(),
  vatMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  shipTo: z.string().min(1).max(1000),
  orderUrl: z.string().url().optional(),
  trackingUrl: z.string().url().optional(),
  carrier: z.string().max(200).optional(),
  refundMinor: z.number().int().nonnegative().optional(),
});

export interface CommerceEmailProfile {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  storefrontUrl: string;
  brand: Brand;
  edits?: Partial<Record<TemplateId, Editable>>;
}

const safeName = (value: string) => value.replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

function money(minor: number, currency: string): string {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100); }
  catch { throw new PermanentError(`Unsupported email currency ${currency}`); }
}

function placed(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new PermanentError('Commerce event has an invalid order date');
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** Converts immutable commerce-event data into the shared React Email templates. No values are invented. */
/** The sender for emails about a person's own account (invitations, password resets). These come from the platform, not from a shop. */
export interface PlatformEmailProfile { fromName: string; fromEmail: string; replyTo?: string }
const AccountTemplate = z.enum(['staff_invite', 'staff_password_reset']);
const AccountPayload = z.object({ name: z.string().min(1).max(200), actionUrl: z.string().url().max(500), validHours: z.number().positive().max(24 * 30), role: z.string().max(60).optional(), invitedBy: z.string().max(200).optional() });

export function commerceEmailPreparer(profileFor: (storeId: string) => Promise<CommerceEmailProfile | null>, platform?: PlatformEmailProfile) {
  return async (request: SendRequest): Promise<PreparedEmail> => {
    const account = AccountTemplate.safeParse(request.template);
    if (account.success) {
      if (!platform) throw new PermanentError('Platform email sender is not configured');
      const d = AccountPayload.safeParse(request.data); if (!d.success) throw new PermanentError('Account email event does not contain a complete link');
      const from = z.string().email().safeParse(platform.fromEmail); if (!from.success) throw new PermanentError('Platform email sender is invalid');
      const rendered = await renderAccountEmail(account.data, d.data);
      return { from: `${safeName(platform.fromName)} <${from.data}>`, replyTo: platform.replyTo, subject: rendered.subject, html: rendered.html, text: rendered.text };
    }
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
    let orderUrl: string;
    try { orderUrl = p.orderUrl ?? new URL(`/account/orders/${encodeURIComponent(p.orderCode)}`, profile.storefrontUrl).toString(); }
    catch { throw new PermanentError('Storefront URL is invalid'); }
    const order: OrderData = {
      number: p.orderCode, placed: placed(p.placedAt), customerName: p.customerName,
      lines: p.lines.map(l => ({ title: l.title, qty: l.quantity, unit: m(l.unitMinor) })),
      subtotal: m(p.subtotalMinor), shipping: m(p.shippingMinor), discount: p.discountMinor ? m(p.discountMinor) : undefined,
      vatIncluded: m(p.vatMinor), total: m(p.totalMinor), shipTo: p.shipTo, orderUrl,
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
