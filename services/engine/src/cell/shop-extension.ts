import gql from 'graphql-tag';
import { Resolver, Mutation } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Allow, Ctx, Permission, RequestContext, ActiveOrderService, OrderService, Transaction } from '@vendure/core';
import { CellPlugin } from './plugin.ts';
import { createPaymentIntentForOrder, PaymentError } from './connect-payments.ts';

/** Shop API extension used by the shared checkout. The browser never supplies an amount, currency, fee or account:
 *  all are derived here from the shopper's own active order, which Vendure scopes to their session and channel. */
export const shopApiExtensions = gql`
  type PaymentSession { clientSecret: String! paymentIntentId: String! publishableKey: String! stripeAccount: String! amount: Int! currency: String! orderCode: String! }
  extend type Mutation { createPaymentSession: PaymentSession! }
`;

@Resolver()
export class PaymentSessionResolver {
  constructor(@Inject(ActiveOrderService) private active: ActiveOrderService, @Inject(OrderService) private orders: OrderService) {}
  @Transaction() @Mutation() @Allow(Permission.Public)
  async createPaymentSession(@Ctx() ctx: RequestContext) {
    const o = CellPlugin.options; const active = await this.active.getActiveOrder(ctx, undefined);
    if (!active) throw new PaymentError('There is no active order.');
    const order = await this.orders.findOne(ctx, active.id);      // full order with lines and shipping, scoped to the caller's own active order
    if (!order) throw new PaymentError('There is no active order.');
    if (order.state !== 'ArrangingPayment') throw new PaymentError('The order is not ready for payment.');
    if (!order.shippingLines?.length) throw new PaymentError('Choose a delivery method first.');
    const pi = await createPaymentIntentForOrder({ stripe: o.stripe, account: o.account, feeBp: o.feeBp, refundsReturnFee: o.refundsReturnFee }, { code: order.code, id: String(order.id), totalWithTaxMinor: order.totalWithTax, currency: order.currencyCode });
    return { clientSecret: pi.clientSecret, paymentIntentId: pi.id, publishableKey: o.publishableKey, stripeAccount: o.account, amount: order.totalWithTax, currency: order.currencyCode.toLowerCase(), orderCode: order.code };
  }
}
