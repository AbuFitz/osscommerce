import gql from 'graphql-tag';
import { randomInt } from 'node:crypto';
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Inject, Injectable } from '@nestjs/common';
import { Administrator, AdministratorService, Allow, Ctx, NativeAuthenticationMethod, PasswordCipher, Permission, RequestContext, Role, RoleService, Transaction, User, TransactionalConnection, UserInputError } from '@vendure/core';
import { ManageStaff, ReadActivity, STAFF_ROLES, isStaffRole, MERCHANT_PERMISSIONS, type StaffRole } from './merchant-role.ts';
import { ActivityService } from './activity.ts';
import { OssStaffToken, hashToken, newToken, INVITE_MINUTES, RESET_MINUTES } from './staff-token.ts';
import { OutboxService } from './events.ts';
import { CellPlugin } from './plugin.ts';
import { PLATFORM_ACTOR } from './activity.ts';

export const staffApiExtensions = gql`
  type StaffMember { id: ID! name: String! email: String! role: String! owner: Boolean! pending: Boolean! }
  type StaffInvite { id: ID! email: String! }
  type ActivityEntry { id: Int! at: DateTime! actor: String! action: String! summary: String! subjectType: String subjectId: String }
  type ActivityPage { items: [ActivityEntry!]! hasMore: Boolean! }
  extend type Query { myRole: String! staffMembers: [StaffMember!]! activity(take: Int, before: Int, actor: String): ActivityPage! }
  extend type Mutation {
    inviteStaff(email: String!, firstName: String!, lastName: String!, role: String!): StaffInvite!
    setStaffRole(id: ID!, role: String!): Boolean!
    removeStaff(id: ID!): Boolean!
    changeMyPassword(current: String!, next: String!): Boolean!
    resendStaffInvite(id: ID!): Boolean!
    acceptStaffToken(token: String!, password: String!): Boolean!
    requestStaffPasswordReset(email: String!): Boolean!
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
  constructor(@Inject(TransactionalConnection) private conn: TransactionalConnection, @Inject(AdministratorService) private admins: AdministratorService, @Inject(RoleService) private roles: RoleService, @Inject(PasswordCipher) private cipher: PasswordCipher, @Inject(ActivityService) private activity: ActivityService, @Inject(OutboxService) private outbox: OutboxService) {}

  /** Everyone with a role in this store: the owner and the staff. Never anyone from another store, and never the platform team. */
  async list(ctx: RequestContext) {
    const codes = ['owner', 'manager', 'fulfilment', 'analyst'].map(r => roleCode(r, ctx)).concat(['merchant-owner']);
    const rows = await this.conn.getRepository(ctx, Administrator).createQueryBuilder('a').innerJoinAndSelect('a.user', 'u').innerJoinAndSelect('u.roles', 'r').innerJoin('r.channels', 'ch', 'ch.id = :ch', { ch: ctx.channelId }).where('r.code IN (:...codes)', { codes }).andWhere('a.deletedAt IS NULL').orderBy('a.id', 'ASC').getMany();
    return rows.map(a => { const code = a.user.roles.find(r => codes.includes(r.code))!.code; const kind = code.startsWith('owner-') || code === 'merchant-owner' ? 'owner' : code.split('-')[0]; return { id: a.id, name: `${a.firstName} ${a.lastName}`.trim() || a.emailAddress, email: a.emailAddress, role: kind, owner: kind === 'owner', pending: !a.user.verified }; });
  }
  /** The signed-in person's role in this store: owner, manager, fulfilment or analyst. The platform operator counts as owner. Vendure hides role lists from non-administrators of the whole system, so the portal asks here. */
  async myRole(ctx: RequestContext): Promise<string> {
    if (ctx.session?.user?.channelPermissions?.some(c => c.permissions.includes(Permission.SuperAdmin))) return 'owner';
    const me = ctx.activeUserId ? await this.admins.findOneByUserId(ctx, ctx.activeUserId) : null;
    return (me && (await this.list(ctx)).find(m => String(m.id) === String(me.id))?.role) || 'analyst';
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
    this.portal();   // refuse before creating anyone if the invitation email could not carry a link
    const role = await this.staffRole(ctx, i.role);
    // The account starts with a password nobody knows, and unverified. The only way in is the emailed link.
    const a = await this.admins.create(ctx, { emailAddress: email, firstName: i.firstName.trim(), lastName: i.lastName.trim(), password: temporaryPassword(), roleIds: [role.id] });
    await this.conn.getRepository(ctx, User).update(a.user.id, { verified: false });
    await this.activity.record(ctx, { action: 'staff.invited', summary: `Invited ${i.firstName.trim()} ${i.lastName.trim()} as ${STAFF_ROLES[i.role].label}`, subjectType: 'staff', subjectId: a.id });
    await this.sendLink(ctx, { id: String(a.id), email, name: `${i.firstName.trim()} ${i.lastName.trim()}`, role: STAFF_ROLES[i.role].label }, 'invite');
    return { id: a.id, email };
  }
  /** The address the emailed links point at. Without it an invitation could never be completed, so nothing is created. */
  private portal() { const u = CellPlugin.options.portalUrl; if (!u) throw new UserInputError('Invitation emails are not set up for this store yet.'); return u.replace(/\/$/, ''); }
  /** One live link per person and purpose: asking again cancels the earlier link. */
  private async issue(ctx: RequestContext, adminId: string, purpose: 'invite' | 'reset') {
    const repo = this.conn.getRepository(ctx, OssStaffToken); await repo.delete({ channelId: String(ctx.channelId), administratorId: adminId, purpose });
    const token = newToken(); await repo.save(repo.create({ channelId: String(ctx.channelId), administratorId: adminId, purpose, tokenHash: hashToken(token), expiresMin: Math.floor(Date.now() / 60_000) + (purpose === 'invite' ? INVITE_MINUTES : RESET_MINUTES) }));
    return token;
  }
  private async sendLink(ctx: RequestContext, who: { id: string; email: string; name: string; role?: string }, purpose: 'invite' | 'reset') {
    const token = await this.issue(ctx, who.id, purpose); const hours = (purpose === 'invite' ? INVITE_MINUTES : RESET_MINUTES) / 60;
    const by = ctx.activeUserId ? (await this.admins.findOneByUserId(ctx, ctx.activeUserId)) : null; const inviter = by ? `${by.firstName} ${by.lastName}`.trim() : '';
    await this.outbox.outbox.add({ id: `${CellPlugin.options.storeId}:staff:${purpose}:${hashToken(token).slice(0, 16)}`, storeId: CellPlugin.options.storeId, type: purpose === 'invite' ? 'staff.invited' : 'staff.password_reset', occurredAt: new Date().toISOString(),
      subject: {}, recipient: { email: who.email, name: who.name }, consent: { marketing: false },
      data: { name: who.name, role: who.role, invitedBy: inviter && inviter !== PLATFORM_ACTOR ? inviter : undefined, actionUrl: `${this.portal()}/set-password?k=${purpose}&t=${token}`, validHours: hours } });
  }
  async resend(ctx: RequestContext, id: string) {
    const m = await this.mine(ctx, id); if (!m.pending) throw new UserInputError('They have already set a password.');
    await this.sendLink(ctx, { id: String(m.id), email: m.email, name: m.name, role: STAFF_ROLES[m.role as StaffRole]?.label }, 'invite'); return true;
  }
  /** Whoever asks, the answer is the same, so this cannot be used to find out who works in a store. */
  async requestReset(ctx: RequestContext, email: string) {
    const e = email.trim().toLowerCase(); if (!EMAIL.test(e)) return true;
    const m = (await this.list(ctx)).find(x => x.email.toLowerCase() === e);
    if (m) await this.sendLink(ctx, { id: String(m.id), email: m.email, name: m.name }, m.pending ? 'invite' : 'reset'); return true;
  }
  /** The link is the proof that the person owns the inbox: using it sets the password and marks the account verified. A link works once, for an hour (a reset) or a week (an invitation). */
  async accept(ctx: RequestContext, token: string, password: string) {
    const bad = () => new UserInputError('This link has expired or has already been used. Ask for a new one.');
    if (password.length < 10) throw new UserInputError('Use at least 10 characters.');
    const repo = this.conn.getRepository(ctx, OssStaffToken); const row = await repo.findOne({ where: { tokenHash: hashToken(token), channelId: String(ctx.channelId) } });
    if (!row || row.expiresMin < Math.floor(Date.now() / 60_000)) throw bad();
    const m = (await this.list(ctx)).find(x => String(x.id) === row.administratorId); if (!m) { await repo.delete(row.id); throw bad(); }
    const admin = await this.conn.getRepository(ctx, Administrator).findOne({ where: { id: m.id }, relations: ['user'] }); if (!admin) throw bad();
    const methods = this.conn.getRepository(ctx, NativeAuthenticationMethod); const n = await methods.createQueryBuilder('n').innerJoin('n.user', 'u').where('u.id = :id', { id: admin.user.id }).getOne(); if (!n) throw bad();
    await methods.update(n.id, { passwordHash: await this.cipher.hash(password) }); await this.conn.getRepository(ctx, User).update(admin.user.id, { verified: true });
    await repo.delete({ administratorId: row.administratorId, channelId: row.channelId });
    await this.activity.recordAs(ctx, { id: String(m.id), name: m.name }, { action: row.purpose === 'invite' ? 'staff.joined' : 'staff.password', summary: row.purpose === 'invite' ? `${m.name} accepted the invitation` : `${m.name} chose a new password`, subjectType: 'staff', subjectId: m.id });
    return true;
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
  @Query() @Allow(Permission.Authenticated) myRole(@Ctx() ctx: RequestContext) { return this.staff.myRole(ctx); }
  @Query() @Allow(ManageStaff.Permission) staffMembers(@Ctx() ctx: RequestContext) { return this.staff.list(ctx); }
  @Query() @Allow(ReadActivity.Permission) activity(@Ctx() ctx: RequestContext, @Args() a: { take?: number; before?: number; actor?: string }) { return this.log.list(ctx, a); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) inviteStaff(@Ctx() ctx: RequestContext, @Args() a: { email: string; firstName: string; lastName: string; role: string }) { return this.staff.invite(ctx, a); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) setStaffRole(@Ctx() ctx: RequestContext, @Args() a: { id: string; role: string }) { return this.staff.setRole(ctx, a.id, a.role); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) removeStaff(@Ctx() ctx: RequestContext, @Args() a: { id: string }) { return this.staff.remove(ctx, a.id); }
  @Transaction() @Mutation() @Allow(ManageStaff.Permission) resendStaffInvite(@Ctx() ctx: RequestContext, @Args() a: { id: string }) { return this.staff.resend(ctx, a.id); }
  @Transaction() @Mutation() @Allow(Permission.Public) acceptStaffToken(@Ctx() ctx: RequestContext, @Args() a: { token: string; password: string }) { return this.staff.accept(ctx, a.token, a.password); }
  @Transaction() @Mutation() @Allow(Permission.Public) requestStaffPasswordReset(@Ctx() ctx: RequestContext, @Args() a: { email: string }) { return this.staff.requestReset(ctx, a.email); }
  @Transaction() @Mutation() @Allow(Permission.Authenticated) changeMyPassword(@Ctx() ctx: RequestContext, @Args() a: { current: string; next: string }) { return this.staff.changePassword(ctx, a.current, a.next); }
}
export { MERCHANT_PERMISSIONS };
