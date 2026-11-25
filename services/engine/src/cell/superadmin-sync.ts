import { Administrator, AuthenticatedSession, NativeAuthenticationMethod, PasswordCipher, TransactionalConnection, User } from '@vendure/core';

export interface SyncResult { identifier: boolean; password: boolean; retired: string[] }

/**
 * Makes the platform operator's sign-in match the environment on every start.
 * Vendure only reads SUPERADMIN_USER and SUPERADMIN_PASSWORD when it first creates the account, and a changed username creates a SECOND operator instead of renaming
 * the first. So after a rotation the old operator, with the old password, would still be there. Here the environment is the source of truth:
 *  - the operator whose username matches the environment is kept and given the environment's password;
 *  - any other operator account is retired (removed and signed out), so credentials that have been replaced stop working;
 *  - with exactly one operator and a changed username, it is renamed.
 * It never removes the last operator, and refuses to guess when several exist and none matches.
 */
export async function syncSuperadmin(conn: TransactionalConnection, cipher: PasswordCipher, identifier: string, password: string): Promise<SyncResult> {
  const nativeRepo = conn.rawConnection.getRepository(NativeAuthenticationMethod);
  const natives = await nativeRepo.createQueryBuilder('n').addSelect('n.passwordHash').innerJoinAndSelect('n.user', 'u').innerJoin('u.roles', 'r').where('r.code = :c', { c: '__super_admin_role__' }).andWhere('u.deletedAt IS NULL').getMany();
  const match = natives.find(n => n.user.identifier === identifier) ?? (natives.length === 1 ? natives[0] : undefined);
  if (!match) throw new Error(`Found ${natives.length} operator accounts and none is named like SUPERADMIN_USER. Refusing to guess which to keep.`);
  const u = match.user; const out: SyncResult = { identifier: u.identifier !== identifier, password: !(await cipher.check(password, match.passwordHash)), retired: [] };
  if (out.password) await nativeRepo.update(match.id, { passwordHash: await cipher.hash(password) });
  if (out.identifier) { await conn.rawConnection.getRepository(User).update(u.id, { identifier }); await conn.rawConnection.getRepository(Administrator).update({ user: { id: u.id } } as never, { emailAddress: identifier }); }
  const others = natives.filter(n => n !== match);
  // Retire the others directly. Vendure's own delete hides operator accounts from every caller but itself, and this is the platform acting on its own accounts.
  for (const o of others) {
    const now = new Date(); await conn.rawConnection.getRepository(Administrator).update({ user: { id: o.user.id } } as never, { deletedAt: now }); await conn.rawConnection.getRepository(User).update(o.user.id, { deletedAt: now });
    await conn.rawConnection.getRepository(AuthenticatedSession).delete({ user: { id: o.user.id } } as never); out.retired.push(o.user.identifier);
  }
  return out;
}
