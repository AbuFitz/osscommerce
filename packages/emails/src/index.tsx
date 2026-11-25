import * as React from 'react';
import { Body, Button, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';
import { render } from '@react-email/render';

/**
 * Transactional email templates. The merchant controls brand and a few supported fields (subject, preheader, intro, footer);
 * order data, totals, legal lines and links are not editable. No logo means no image: the shop name is set in type instead.
 * Marketing email is a separate stream and is never rendered from these templates.
 */
export interface Brand { shopName: string; accent: string; logoUrl?: string; supportEmail: string; address?: string; footer?: string }
export interface Line { title: string; qty: number; unit: string }
export interface OrderData { number: string; placed: string; customerName: string; lines: Line[]; subtotal: string; shipping: string; discount?: string; vatIncluded: string; total: string; shipTo: string; trackingUrl?: string; carrier?: string; refund?: string; orderUrl: string }
export interface Editable { subject?: string; preheader?: string; intro?: string }
export type TemplateId = 'order_confirmation' | 'order_dispatched' | 'refund_confirmation' | 'payment_failed' | 'password_reset' | 'merchant_new_order';
export const TEMPLATES: { id: TemplateId; label: string; audience: 'customer' | 'merchant'; subject: (o: OrderData, b: Brand) => string; intro: (o: OrderData) => string; preheader: (o: OrderData) => string }[] = [
  { id: 'order_confirmation', label: 'Order confirmation', audience: 'customer', subject: (o, b) => `Your ${b.shopName} order #${o.number}`, intro: o => `Thanks, ${o.customerName}. We have your order and will email you again when it ships.`, preheader: o => `Order #${o.number} · ${o.total}` },
  { id: 'order_dispatched', label: 'Order dispatched', audience: 'customer', subject: (o, b) => `Your ${b.shopName} order #${o.number} is on its way`, intro: o => `Good news, ${o.customerName}. Your order has been dispatched.`, preheader: o => `Track order #${o.number}` },
  { id: 'refund_confirmation', label: 'Refund confirmation', audience: 'customer', subject: (o, b) => `Your refund from ${b.shopName}`, intro: o => `We have refunded ${o.refund ?? o.total} for order #${o.number}. It can take a few days to reach your account.`, preheader: o => `Refund for order #${o.number}` },
  { id: 'payment_failed', label: 'Payment failed', audience: 'customer', subject: (o, b) => `Your payment to ${b.shopName} did not go through`, intro: () => 'Your payment was not completed and you have not been charged. You can try again with the link below.', preheader: o => `Order #${o.number} needs a new payment` },
  { id: 'password_reset', label: 'Password reset', audience: 'customer', subject: (_o, b) => `Reset your ${b.shopName} password`, intro: () => 'Use the button below to choose a new password. The link works once and expires in an hour. If you did not ask for this, ignore this email.', preheader: () => 'Choose a new password' },
  { id: 'merchant_new_order', label: 'New order (to you)', audience: 'merchant', subject: o => `New order #${o.number} · ${o.total}`, intro: o => `${o.customerName} placed order #${o.number}.`, preheader: o => `${o.total} · ready to fulfil` },
];

const font = 'Inter, -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
function Frame({ brand, preheader, children, about = 'order' }: { brand: Brand; preheader: string; children: React.ReactNode; about?: 'order' | 'account' }) {
  return (
    <Html lang="en-GB"><Head /><Preview>{preheader}</Preview>
      <Body style={{ margin: 0, background: '#f4f3ee', fontFamily: font, color: '#16210f' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
          <Section style={{ padding: '0 8px 20px' }}>{brand.logoUrl ? <Img src={brand.logoUrl} alt={brand.shopName} height="32" /> : <Text style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: brand.accent }}>{brand.shopName}</Text>}</Section>
          <Section style={{ background: '#ffffff', borderRadius: 20, padding: 28 }}>{children}</Section>
          <Section style={{ padding: '20px 8px 0', color: '#6b705f', fontSize: 12, lineHeight: '18px' }}>
            {brand.footer && <Text style={{ margin: '0 0 8px' }}>{brand.footer}</Text>}
            <Text style={{ margin: 0 }}>Questions? Reply or write to <Link href={`mailto:${brand.supportEmail}`} style={{ color: '#6b705f' }}>{brand.supportEmail}</Link>.{brand.address ? ` ${brand.address}` : ''}</Text>
            <Text style={{ margin: '8px 0 0' }}>{about === 'account' ? 'This is a service email about your account. It is not marketing.' : 'This is a service email about your order. It is not marketing.'}</Text>
          </Section>
        </Container>
      </Body></Html>
  );
}
const H = ({ children }: { children: React.ReactNode }) => <Text style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{children}</Text>;
const P = ({ children }: { children: React.ReactNode }) => <Text style={{ margin: '0 0 16px', fontSize: 15, lineHeight: '23px', color: '#3a4030' }}>{children}</Text>;
const Cta = ({ href, children, brand }: { href: string; children: React.ReactNode; brand: Brand }) => <Button href={href} style={{ background: brand.accent, color: '#ffffff', padding: '13px 22px', borderRadius: 999, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>{children}</Button>;
function Items({ o }: { o: OrderData }) {
  const row = (l: string, r: string, bold = false) => <Row><Column style={{ padding: '3px 0', fontSize: 14, color: bold ? '#16210f' : '#6b705f', fontWeight: bold ? 700 : 400 }}>{l}</Column><Column align="right" style={{ padding: '3px 0', fontSize: 14, fontWeight: bold ? 700 : 400 }}>{r}</Column></Row>;
  return (<Section style={{ margin: '18px 0' }}>
    {o.lines.map(l => <Row key={l.title}><Column style={{ padding: '8px 0', fontSize: 14 }}>{l.title}<br /><span style={{ color: '#6b705f', fontSize: 12 }}>{l.qty} × {l.unit}</span></Column></Row>)}
    <Hr style={{ borderColor: '#e4e6dc', margin: '10px 0' }} />
    {row('Subtotal', o.subtotal)}{o.discount && row('Discount', `−${o.discount}`)}{row('Delivery', o.shipping)}{row('VAT included', o.vatIncluded)}{row('Total', o.total, true)}
  </Section>);
}

export function Template({ id, brand, order, edit = {} }: { id: TemplateId; brand: Brand; order: OrderData; edit?: Editable }) {
  const t = TEMPLATES.find(x => x.id === id)!;
  const intro = edit.intro?.trim() || t.intro(order);
  const pre = edit.preheader?.trim() || t.preheader(order);
  const title = { order_confirmation: 'Order confirmed', order_dispatched: 'On its way', refund_confirmation: 'Refund confirmed', payment_failed: 'Payment not completed', password_reset: 'Reset your password', merchant_new_order: 'New order' }[id];
  return (
    <Frame brand={brand} preheader={pre}>
      <H>{title}</H><P>{intro}</P>
      {id === 'password_reset' && <Cta href={order.orderUrl} brand={brand}>Choose a new password</Cta>}
      {id === 'payment_failed' && <><Items o={order} /><Cta href={order.orderUrl} brand={brand}>Try payment again</Cta></>}
      {(id === 'order_confirmation' || id === 'merchant_new_order') && <><Items o={order} /><Text style={{ margin: '0 0 4px', fontSize: 12, color: '#6b705f' }}>Delivering to</Text><P>{order.shipTo}</P><Cta href={order.orderUrl} brand={brand}>{id === 'merchant_new_order' ? 'Open the order' : 'View your order'}</Cta></>}
      {id === 'order_dispatched' && <><P>{order.carrier ? `Carrier: ${order.carrier}. ` : ''}Delivering to {order.shipTo}.</P>{order.trackingUrl && <Cta href={order.trackingUrl} brand={brand}>Track your parcel</Cta>}<Items o={order} /></>}
      {id === 'refund_confirmation' && <><Items o={order} /><P>Refunded: {order.refund ?? order.total}.</P></>}
    </Frame>
  );
}

export interface Rendered { subject: string; html: string; text: string }
export async function renderTemplate(id: TemplateId, brand: Brand, order: OrderData, edit: Editable = {}): Promise<Rendered> {
  const t = TEMPLATES.find(x => x.id === id)!;
  const el = <Template id={id} brand={brand} order={order} edit={edit} />;
  return { subject: edit.subject?.trim() || t.subject(order, brand), html: await render(el), text: await render(el, { plainText: true }) };
}
export const SAMPLE_ORDER: OrderData = { number: '1043', placed: '14 Nov 2026', customerName: 'Maya', lines: [{ title: 'Stoneware mug, speckled', qty: 2, unit: '£18.00' }, { title: 'Linen apron', qty: 1, unit: '£34.00' }], subtotal: '£70.00', shipping: '£4.95', vatIncluded: '£12.49', total: '£74.95', shipTo: '12 Mill Lane, Bristol BS1 4AX', trackingUrl: 'https://example.com/track/123', carrier: 'Royal Mail Tracked', refund: '£18.00', orderUrl: 'https://example.com/orders/1043' };

/** Emails about someone's own account on the platform (an invitation, a password reset). They come from OneSimpleCommerce, not from a shop, and a shop cannot edit or switch them off. */
export type AccountTemplateId = 'staff_invite' | 'staff_password_reset';
export interface AccountData { name: string; actionUrl: string; validHours: number; role?: string; invitedBy?: string }
const hoursText = (h: number) => (h % 24 === 0 && h >= 48 ? `${h / 24} days` : h === 1 ? 'an hour' : `${h} hours`);
export const ACCOUNT_BRAND: Brand = { shopName: 'OneSimpleCommerce', accent: '#4f46e5', supportEmail: 'support@onesimplecommerce.com' };
const ACCOUNT_COPY: Record<AccountTemplateId, { subject: (d: AccountData) => string; title: string; intro: (d: AccountData) => string; button: string }> = {
  staff_invite: { subject: d => d.invitedBy ? `${d.invitedBy} invited you to OneSimpleCommerce` : 'You have been invited to OneSimpleCommerce', title: 'Join the team',
    intro: d => `Hi ${d.name.split(' ')[0] || 'there'}, ${d.invitedBy ? `${d.invitedBy} has` : 'you have been'} ${d.invitedBy ? 'added you' : 'added'} to their store${d.role ? ` as ${d.role}` : ''}. Choose a password to finish setting up your account. The link works once and lasts ${hoursText(d.validHours)}.`, button: 'Choose a password' },
  staff_password_reset: { subject: () => 'Reset your OneSimpleCommerce password', title: 'Reset your password',
    intro: d => `Use the button below to choose a new password. The link works once and lasts ${hoursText(d.validHours)}. If you did not ask for this, you can ignore this email and your password will not change.`, button: 'Choose a new password' },
};
export async function renderAccountEmail(id: AccountTemplateId, d: AccountData, brand: Brand = ACCOUNT_BRAND): Promise<Rendered> {
  const c = ACCOUNT_COPY[id];
  const el = (<Frame brand={{ ...brand, footer: undefined }} about="account" preheader={c.title}><H>{c.title}</H><P>{c.intro(d)}</P><Cta href={d.actionUrl} brand={brand}>{c.button}</Cta>
    <Text style={{ margin: '18px 0 0', fontSize: 12, color: '#6b705f', lineHeight: '18px' }}>If the button does not work, copy this address into your browser:<br />{d.actionUrl}</Text></Frame>);
  return { subject: c.subject(d), html: await render(el), text: await render(el, { plainText: true }) };
}
