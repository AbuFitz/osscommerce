import gql from 'graphql-tag';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Address, Allow, Ctx, Customer, CustomerHistoryEntry, NativeAuthenticationMethod, Order, Permission, RequestContext, Transaction, TransactionalConnection, User, UserInputError } from '@vendure/core';
import { ActivityService } from './activity.ts';

export const privacyApiExtensions = gql`
  extend type Query { customerDataExport(id: ID!): String! }
  extend type Mutation { eraseCustomer(id: ID!): Boolean! }
`;
/** Orders in these states are finished. Erasing someone with an order still on its way would leave a parcel nobody can address. */
const FINISHED = new Set(['Shipped', 'Delivered', 'Cancelled']);
const CLEAN = { fullName: 'Erased customer', company: '', streetLine1: 'Erased', streetLine2: '', city: '', province: '', postalCode: '', phoneNumber: '' };

@Injectable()
export class PrivacyService {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(ActivityService) private activity: ActivityService) {}

  /** A customer of THIS store, or "not found": another store's customer is indistinguishable from one that does not exist. */
  private async mine(ctx: RequestContext, id: string) {
    const c = await this.conn.getRepository(ctx, Customer).createQueryBuilder('c').innerJoin('c.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).leftJoinAndSelect('c.addresses', 'a').leftJoinAndSelect('a.country', 'co').where('c.id = :id', { id }).getOne();
    if (!c) throw new UserInputError('That customer was not found.'); return c;
  }
  private orders(ctx: RequestContext, id: string) {
    return this.conn.getRepository(ctx, Order).createQueryBuilder('o').innerJoin('o.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).leftJoinAndSelect('o.lines', 'l').leftJoinAndSelect('l.productVariant', 'v').leftJoinAndSelect('o.payments', 'p').where('o.customerId = :id', { id }).andWhere('o.orderPlacedAt IS NOT NULL').orderBy('o.orderPlacedAt', 'ASC').getMany();
  }

  /** Everything held about one person, in one readable file: what they gave us, what they bought, and what the team wrote about them. */
  async export(ctx: RequestContext, id: string): Promise<string> {
    const c = await this.mine(ctx, id); const orders = await this.orders(ctx, id);
    const notes = await this.conn.getRepository(ctx, CustomerHistoryEntry).find({ where: { customer: { id: c.id } } as never, order: { createdAt: 'ASC' } });
    const out = {
      exportedAt: new Date().toISOString(), customer: { id: c.id, title: c.title, firstName: c.firstName, lastName: c.lastName, email: c.emailAddress, phone: c.phoneNumber, createdAt: c.createdAt },
      addresses: c.addresses.map(a => ({ fullName: a.fullName, company: a.company, streetLine1: a.streetLine1, streetLine2: a.streetLine2, city: a.city, province: a.province, postalCode: a.postalCode, country: a.country?.name, phone: a.phoneNumber })),
      orders: orders.map(o => ({ code: o.code, placedAt: o.orderPlacedAt, state: o.state, currency: o.currencyCode, totalWithTax: o.totalWithTax, shippingAddress: o.shippingAddress, billingAddress: o.billingAddress, items: o.lines.map(l => ({ sku: l.productVariant?.sku, quantity: l.quantity, unitPriceWithTax: l.proratedUnitPriceWithTax })), payments: o.payments.map(p => ({ method: p.method, state: p.state, amount: p.amount })) })),
      notes: notes.filter(h => h.type === 'CUSTOMER_NOTE').map(h => ({ at: h.createdAt, note: (h.data as { note?: string }).note })),
    };
    await this.activity.record(ctx, { action: 'customer.exported', summary: `Exported the data held about ${`${c.firstName} ${c.lastName}`.trim() || 'a customer'}`, subjectType: 'customer', subjectId: c.id });
    return JSON.stringify(out, null, 2);
  }

  /**
   * Removes the personal details and keeps the sale. The name, email, phone, addresses, notes and login go; the orders stay (the shop must keep its sales records) with the address on each blanked to the country.
   * Refused while any order is unfinished, so nothing is left unshippable.
   */
  async erase(ctx: RequestContext, id: string): Promise<boolean> {
    const c = await this.mine(ctx, id); const orders = await this.orders(ctx, id);
    if (orders.some(o => !FINISHED.has(o.state))) throw new UserInputError('This customer has an order that is not finished yet. Fulfil or cancel it first.');
    const who = `${c.firstName} ${c.lastName}`.trim() || 'a customer'; const email = `erased-${c.id}@erased.invalid`;
    for (const o of orders) await this.conn.getRepository(ctx, Order).update(o.id, { shippingAddress: { ...CLEAN, country: o.shippingAddress?.country, countryCode: o.shippingAddress?.countryCode }, billingAddress: { ...CLEAN, country: o.billingAddress?.country, countryCode: o.billingAddress?.countryCode } });
    // A guest cart left open holds an address too.
    await this.conn.getRepository(ctx, Order).createQueryBuilder().update(Order).set({ shippingAddress: { ...CLEAN } as never, billingAddress: { ...CLEAN } as never }).where('customerId = :id AND orderPlacedAt IS NULL', { id: c.id }).execute();
    await this.conn.getRepository(ctx, CustomerHistoryEntry).createQueryBuilder().delete().where('customerId = :id', { id: c.id }).execute();
    for (const a of c.addresses) await this.conn.getRepository(ctx, Address).delete(a.id);
    const user = (await this.conn.getRepository(ctx, Customer).findOne({ where: { id: c.id }, relations: ['user'] }))?.user;
    if (user) { await this.conn.getRepository(ctx, NativeAuthenticationMethod).createQueryBuilder().delete().where('userId = :u', { u: user.id }).execute(); await this.conn.getRepository(ctx, User).update(user.id, { identifier: email, deletedAt: new Date() }); }
    await this.conn.getRepository(ctx, Customer).update(c.id, { title: '', firstName: 'Erased', lastName: 'customer', emailAddress: email, phoneNumber: '' });
    await this.activity.record(ctx, { action: 'customer.erased', summary: `Erased the personal data of ${who}`, subjectType: 'customer', subjectId: c.id });
    return true;
  }
}

@Resolver()
export class PrivacyResolver {
  constructor(@Inject(PrivacyService) private privacy: PrivacyService) {}
  @Query() @Allow(Permission.ReadCustomer) customerDataExport(@Ctx() ctx: RequestContext, @Args() a: { id: string }) { return this.privacy.export(ctx, a.id); }
  @Transaction() @Mutation() @Allow(Permission.UpdateCustomer) eraseCustomer(@Ctx() ctx: RequestContext, @Args() a: { id: string }) { return this.privacy.erase(ctx, a.id); }
}
