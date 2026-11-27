import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantGuard } from './tenant-guard.ts';
import { VendurePlugin, PluginCommonModule, Injector, TransactionalConnection, Order, RequestContext, ID } from '@vendure/core';
import { OssOutbox } from './outbox-entity.ts';
import { OutboxService } from './events.ts';
import { OSS_CALCULATORS, deliveryZoneChecker } from './shipping.ts';
import { fixedOrderDiscount, buyXGetYAction } from './discounts.ts';
import { PaymentSessionResolver, shopApiExtensions } from './shop-extension.ts';
import { STOCK_RESOLVERS, stockApiExtensions } from './stock-extension.ts';
import { StaffResolver, StaffService, staffApiExtensions } from './staff.ts';
import { ActivityService, OssActivity } from './activity.ts';
import { OssStaffToken } from './staff-token.ts';
import { DescriptionGuard } from './description-guard.ts';
import { OssSegment, SegmentResolver, SegmentService, segmentApiExtensions } from './segments.ts';
import { OssReview, ReviewAdminResolver, ReviewService, ReviewShopResolver, reviewAdminExtensions, reviewShopExtensions } from './reviews.ts';
import { OssTrade, TradeResolver, TradeService, tradeApiExtensions } from './trade.ts';
import { RateLimit } from './rate-limit.ts';
import { PrivacyResolver, PrivacyService, privacyApiExtensions } from './privacy.ts';
import { ManageStaff, ReadActivity } from './merchant-role.ts';
import { print } from 'graphql';
import gql from 'graphql-tag';
import Stripe from 'stripe';
import { connectHandler } from './handler.ts';
import { stripeWebhookMiddleware, WEBHOOK_PATH } from './webhook-route.ts';
import { controlMiddleware, CONTROL_PATH } from './control-route.ts';
import type { StripePort } from './stripe-port.ts';
import type { PaymentState, WebhookDeps } from './webhooks.ts';

/** Independent reasons that may close checkout. One source becoming healthy must never
 * erase another source's restriction (for example, a merchant unpausing while Stripe is restricted). */
export type CheckoutGateSource = 'payments' | 'merchant';
export interface CheckoutGate {
  get(): Promise<{ allowed: boolean; reason?: string }>;
  set(allowed: boolean, reason?: string, source?: CheckoutGateSource): Promise<void>;
}
export class MemGate implements CheckoutGate {
  private states = new Map<CheckoutGateSource, { allowed: boolean; reason?: string }>();
  constructor(allowed = true, reason?: string) { this.states.set('payments', { allowed, reason }); }
  get allowed() { return [...this.states.values()].every(state => state.allowed); }
  get reason() { return [...this.states.values()].find(state => !state.allowed)?.reason; }
  async get() { return { allowed: this.allowed, reason: this.reason }; }
  async set(allowed: boolean, reason?: string, source: CheckoutGateSource = 'payments') { this.states.set(source, { allowed, reason }); }
}
export interface CellPluginOptions { stripe: StripePort; sdk: Stripe; account: string; webhookSecret: string; feeBp: number; refundsReturnFee: boolean; storeId: string; publishableKey: string;
  checkoutGate?: CheckoutGate; controlSecret?: string; /** Where emailed staff links point: the merchant portal's address. Without it, invitations are refused. */ portalUrl?: string;
  outbox?: { cellId: string; secret: string; url: string; post(url: string, init: { body: string; headers: Record<string, string> }): Promise<{ status: number }>; intervalMs?: number; onAlert?: (m: string) => void } }

/** Registers the Connect payment handler and mounts the signed webhook route. Order lookups go through Vendure's own connection. */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [OssOutbox, OssActivity, OssStaffToken, OssSegment, OssReview, OssTrade],
  providers: [OutboxService, ActivityService, StaffService, PrivacyService, DescriptionGuard, SegmentService, ReviewService, TradeService, { provide: APP_INTERCEPTOR, useClass: TenantGuard }, { provide: APP_INTERCEPTOR, useClass: RateLimit }],
  shopApiExtensions: { schema: gql`${print(shopApiExtensions)}\n${print(reviewShopExtensions)}`, resolvers: [PaymentSessionResolver, ReviewShopResolver] },
  adminApiExtensions: { schema: gql`${print(stockApiExtensions)}\n${print(staffApiExtensions)}\n${print(privacyApiExtensions)}\n${print(segmentApiExtensions)}\n${print(reviewAdminExtensions)}\n${print(tradeApiExtensions)}`, resolvers: [...STOCK_RESOLVERS, StaffResolver, PrivacyResolver, SegmentResolver, ReviewAdminResolver, TradeResolver] },
  configuration: (config) => {
    const o = CellPlugin.options;
    config.paymentOptions.paymentMethodHandlers.push(connectHandler({ stripe: o.stripe, account: o.account, feeBp: o.feeBp, refundsReturnFee: o.refundsReturnFee }));
    config.apiOptions.middleware = [...(config.apiOptions.middleware ?? []), { route: WEBHOOK_PATH, beforeListen: true, handler: stripeWebhookMiddleware({ stripe: o.sdk, secret: o.webhookSecret, deps: CellPlugin.deps }) },
      ...(o.controlSecret && o.checkoutGate ? [{ route: CONTROL_PATH, beforeListen: true, handler: controlMiddleware({ secret: o.controlSecret, gate: o.checkoutGate }) }] : [])];
    config.authOptions.customPermissions = [...(config.authOptions.customPermissions ?? []), ManageStaff, ReadActivity];
    config.shippingOptions.shippingCalculators = [...(config.shippingOptions.shippingCalculators ?? []), ...OSS_CALCULATORS];
    config.shippingOptions.shippingEligibilityCheckers = [...(config.shippingOptions.shippingEligibilityCheckers ?? []), deliveryZoneChecker];
    config.promotionOptions.promotionActions = [...(config.promotionOptions.promotionActions ?? []), fixedOrderDiscount, buyXGetYAction];
    config.customFields.ProductVariant = [...(config.customFields.ProductVariant ?? []), { name: 'weightGrams', type: 'int', defaultValue: 0, public: true, label: [{ languageCode: 'en' as any, value: 'Weight (grams)' }] }];
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
