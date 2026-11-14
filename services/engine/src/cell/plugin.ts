import { VendurePlugin, PluginCommonModule, Injector, TransactionalConnection, Order, RequestContext, ID } from '@vendure/core';
import { OssOutbox } from './outbox-entity.ts';
import { OutboxService } from './events.ts';
import { PaymentSessionResolver, shopApiExtensions } from './shop-extension.ts';
import Stripe from 'stripe';
import { connectHandler } from './handler.ts';
import { stripeWebhookMiddleware, WEBHOOK_PATH } from './webhook-route.ts';
import { controlMiddleware, CONTROL_PATH } from './control-route.ts';
import type { StripePort } from './stripe-port.ts';
import type { PaymentState, WebhookDeps } from './webhooks.ts';

/** Whether this cell may start a new payment. The control plane sets it from the merchant's Stripe account state. Fails closed when unset in staging/production. */
export interface CheckoutGate { get(): Promise<{ allowed: boolean; reason?: string }>; set(allowed: boolean, reason?: string): Promise<void> }
export class MemGate implements CheckoutGate { constructor(public allowed = true, public reason?: string) {} async get() { return { allowed: this.allowed, reason: this.reason }; } async set(a: boolean, r?: string) { this.allowed = a; this.reason = r; } }
export interface CellPluginOptions { stripe: StripePort; sdk: Stripe; account: string; webhookSecret: string; feeBp: number; refundsReturnFee: boolean; storeId: string; publishableKey: string;
  checkoutGate?: CheckoutGate; controlSecret?: string;
  outbox?: { cellId: string; secret: string; url: string; post(url: string, init: { body: string; headers: Record<string, string> }): Promise<{ status: number }>; intervalMs?: number; onAlert?: (m: string) => void } }

/** Registers the Connect payment handler and mounts the signed webhook route. Order lookups go through Vendure's own connection. */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [OssOutbox],
  providers: [OutboxService],
  shopApiExtensions: { schema: shopApiExtensions, resolvers: [PaymentSessionResolver] },
  configuration: (config) => {
    const o = CellPlugin.options;
    config.paymentOptions.paymentMethodHandlers.push(connectHandler({ stripe: o.stripe, account: o.account, feeBp: o.feeBp, refundsReturnFee: o.refundsReturnFee }));
    config.apiOptions.middleware = [...(config.apiOptions.middleware ?? []), { route: WEBHOOK_PATH, beforeListen: true, handler: stripeWebhookMiddleware({ stripe: o.sdk, secret: o.webhookSecret, deps: CellPlugin.deps }) },
      ...(o.controlSecret && o.checkoutGate ? [{ route: CONTROL_PATH, beforeListen: true, handler: controlMiddleware({ secret: o.controlSecret, gate: o.checkoutGate }) }] : [])];
    config.customFields.Order = [...(config.customFields.Order ?? []),
      { name: 'ossPaymentState', type: 'string', defaultValue: 'pending', public: false, internal: true },
      { name: 'ossPaymentDetail', type: 'string', nullable: true, public: false, internal: true },
      { name: 'ossReview', type: 'string', nullable: true, public: false, internal: true }];
    return config;
  },
})
export class CellPlugin {
  static options: CellPluginOptions;
  static deps: WebhookDeps;
  static init(o: CellPluginOptions, deps: WebhookDeps) { CellPlugin.options = o; CellPlugin.deps = deps; return CellPlugin; }
}

/** Order adapter backed by Vendure's database. The processed-events table is the cell's own (created by the cell migration). */
export function vendureWebhookDeps(account: string, conn: () => TransactionalConnection, markIfNew: WebhookDeps['seen']['markIfNew'], checkout: WebhookDeps['checkout'], ctx: () => RequestContext): WebhookDeps {
  return {
    account, seen: { markIfNew }, checkout,
    orders: {
      async byOrderCode(code) {
        const o = await conn().getRepository(ctx(), Order).findOne({ where: { code } });
        if (!o) return null;
        return { code: o.code, totalWithTaxMinor: o.totalWithTax, currency: o.currencyCode, paymentState: ((o.customFields as any)?.ossPaymentState ?? 'pending') as PaymentState };
      },
      async setPaymentState(code, state, detail) { await conn().getRepository(ctx(), Order).update({ code }, { customFields: { ossPaymentState: state, ossPaymentDetail: detail } } as any); },
      async flagForReview(code, reason) { await conn().getRepository(ctx(), Order).update({ code }, { customFields: { ossReview: reason } } as any); },
    },
  };
}
export type { ID, Injector };
