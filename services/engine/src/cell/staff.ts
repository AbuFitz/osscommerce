import gql from 'graphql-tag';
import { randomInt } from 'node:crypto';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Administrator, AdministratorService, Allow, Ctx, NativeAuthenticationMethod, PasswordCipher, Permission, RequestContext, Role, RoleService, Transaction, TransactionalConnection, UserInputError } from '@vendure/core';
import { ManageStaff, ReadActivity, STAFF_ROLES, isStaffRole, MERCHANT_PERMISSIONS, type StaffRole } from './merchant-role.ts';
import { ActivityService } from './activity.ts';

export const staffApiExtensions = gql`
  type StaffMember { id: ID! name: String! email: String! role: String! owner: Boolean! }
  type StaffInvite { id: ID! email: String! temporaryPassword: String! }
  type ActivityEntry { id: Int! at: DateTime! actor: String! action: String! summary: String! subjectType: String subjectId: String }
  type ActivityPage { items: [ActivityEntry!]! hasMore: Boolean! }
  extend type Query { staffMembers: [StaffMember!]! activity(take: Int, before: Int, actor: String): ActivityPage! }
  extend type Mutation {
    inviteStaff(email: String!, firstName: String!, lastName: String!, role: String!): StaffInvite!
    setStaffRole(id: ID!, role: String!): Boolean!
    removeStaff(id: ID!): Boolean!
    changeMyPassword(current: String!, next: String!): Boolean!
  }
`;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** A one-time password the owner hands over. 14 characters from an alphabet without look-alikes. */
export const temporaryPassword = () => Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const keyOf = (ctx: RequestContext) => ctx.channel.code.replace(/^store-/, '');
const roleCode = (role: string, ctx: RequestContext) => `${role}-${keyOf(ctx)}`;
const EMAIL = /^\S+@\S+\.\S+$/;

@Injectable()
export class StaffService {
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(AdministratorService) private admins: AdministratorService, @Inject(RoleService) private roles: RoleService, @Inject(PasswordCipher) private cipher: PasswordCipher, @Inject(ActivityService) private activity: ActivityService) {}

  /** Everyone with a role in this store: the owner and the staff. Never anyone from another store, and never the platform team. */
  async list(ctx: RequestContext) {
    const codes = ['owner', 'manager', 'fulfilment', 'analyst'].map(r => roleCode(r, ctx)).concat(['merchant-owner']);
    const rows = await this.conn.getRepository(ctx, Administrator).createQueryBuilder('a').innerJoinAndSelect('a.user', 'u').innerJoinAndSelect('u.roles', 'r').innerJoin('r.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).where('r.code IN (:...codes)', { codes }).andWhere('a.deletedAt IS NULL').orderBy('a.id', 'ASC').getMany();
    return rows.map(a => { const code = a.user.roles.find(r => codes.includes(r.code))!.code; const kind = code.startsWith('owner-') || code === 'merchant-owner' ? 'owner' : code.split('-')[0]; return { id: a.id, name: `${a.firstName} ${a.lastName}`.trim() || a.emailAddress, email: a.emailAddress, role: kind, owner: kind === 'owner' }; });
  }
  private async staffRole(ctx: RequestContext, role: StaffRole) {
    const code = roleCode(role, ctx); const repo = this.conn.getRepository(ctx, Role); const found = await repo.findOne({ where: { code } }); if (found) return found;
    // Created here, from the fixed template and in the caller's own channel only. Vendure's role service would demand channel-management rights an owner deliberately does not have.
    return repo.save(new Role({ code, description: `${STAFF_ROLES[role].label} in ${ctx.channel.code}`, permissions: STAFF_ROLES[role].permissions, channels: [ctx.channel] }));
  }
  /** Finds a staff member of THIS store (never the owner). Anything else is "not found", so one store cannot even learn another store's staff exist. */
  private async mine(ctx: RequestContext, id: string | number) { const m = (await this.list(ctx)).find(x => String(x.id) === String(id)); if (!m || m.owner) throw new UserInputError('That team member was not found.'); return m; }

  async invite(ctx: RequestContext, i: { email: string; firstName: string; lastName: string; role: string }) {
    const email = i.email.trim().toLowerCase(); if (!EMAIL.test(email)) throw new UserInputError('Enter a valid email address.');
    if (!isStaffRole(i.role)) throw new UserInputError('Choose Manager, Fulfilment or View only.');
    if (!i.firstName.trim() || !i.lastName.trim()) throw new UserInputError('Enter their first and last name.');
    const taken = await this.conn.getRepository(ctx, Administrator).createQueryBuilder('a').where('LOWER(a.emailAddress) = :e', { e: email }).getCount(); if (taken) throw new UserInputError('That email already has an account. Use a different email address for this person.');
    const role = await this.staffRole(ctx, i.role); const password = temporaryPassword();
    const a = await this.admins.create(ctx, { emailAddress: email, firstName: i.firstName.trim(), lastName: i.lastName.trim(), password, roleIds: [role.id] });
    await this.activity.record(ctx, { action: 'staff.invited', summary: `Added ${i.firstName.trim()} ${i.lastName.trim()} as ${STAFF_ROLES[i.role].label}`, subjectType: 'staff', subjectId: a.id });
    return { id: a.id, email, temporaryPassword: password };
  }
  async setRole(ctx: RequestContext, id: string, role: string) {
    if (!isStaffRole(role)) throw new UserInputError('Choose Manager, Fulfilment or View only.'); const m = await this.mine(ctx, id); const r = await this.staffRole(ctx, role);
    await this.admins.update(ctx, { id, roleIds: [r.id] }); await this.activity.record(ctx, { action: 'staff.role', summary: `Changed ${m.name} to ${STAFF_ROLES[role].label}`, subjectType: 'staff', subjectId: id }); return true;
  }
  async remove(ctx: RequestContext, id: string) { const m = await this.mine(ctx, id); await this.admins.softDelete(ctx, id); await this.activity.record(ctx, { action: 'staff.removed', summary: `Removed ${m.name}`, subjectType: 'staff', subjectId: id }); return true; }
  async changePassword(ctx: RequestContext, current: string, next: string) {
    if (next.length < 10) throw new UserInputError('Use at least 10 characters.'); if (next === current) throw new UserInputError('Choose a password you have not used before.');
    const repo = this.conn.getRepository(ctx, NativeAuthenticationMethod); const n = await repo.createQueryBuilder('n').addSelect('n.passwordHash').innerJoin('n.user', 'u').where('u.id = :id', { id: ctx.activeUserId }).getOne();
    if (!n || !(await this.cipher.check(current, n.passwordHash))) throw new UserInputError('Your current password is not right.');
    await repo.update(n.id, { passwordHash: await this.cipher.hash(next) }); return true;
  }
}

@Resolver()
export class StaffResolver {
  constructor(@Inject(StaffService) private staff: StaffService, @Inject(ActivityService) private log: ActivityService) {}
  @Query() @Allow(ManageStaff.Permission) staffMembers(@Ctx() ctx: RequestContext) { return this.staff.list(ctx); }
  @Query() @Allow(ReadActivity.Permission) activity(@Ctx() ctx: RequestContext, @Args() a: { take?: number; before?: number; actor?: string }) { return this.log.list(ctx, a); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) inviteStaff(@Ctx() ctx: RequestContext, @Args() a: { email: string; firstName: string; lastName: string; role: string }) { return this.staff.invite(ctx, a); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) setStaffRole(@Ctx() ctx: RequestContext, @Args() a: { id: string; role: string }) { return this.staff.setRole(ctx, a.id, a.role); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) removeStaff(@Ctx() ctx: RequestContext, @Args() a: { id: string }) { return this.staff.remove(ctx, a.id); }
  @Transaction() @Mutation() @Allow(Permission.Authenticated) changeMyPassword(@Ctx() ctx: RequestContext, @Args() a: { current: string; next: string }) { return this.staff.changePassword(ctx, a.current, a.next); }
}
export { MERCHANT_PERMISSIONS };
