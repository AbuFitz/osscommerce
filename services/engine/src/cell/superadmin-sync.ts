import { Administrator, NativeAuthenticationMethod, PasswordCipher, TransactionalConnection, User } from '@vendure/core';

/**
 * Makes the platform operator's sign-in match the environment on every start.
 * Vendure only reads SUPERADMIN_USER and SUPERADMIN_PASSWORD when it first creates the account, so rotating them in the host's settings
 * would otherwise change nothing and the old password would keep working. Here the environment is the source of truth.
 * Returns what it changed, so the boot log can say so without ever printing a secret.
 */
export async function syncSuperadmin(conn: TransactionalConnection, cipher: PasswordCipher, identifier: string, password: string): Promise<{ identifier: boolean; password: boolean }> {
  const natives = await conn.rawConnection.getRepository(NativeAuthenticationMethod).createQueryBuilder('n').addSelect('n.passwordHash').innerJoinAndSelect('n.user', 'u').innerJoin('u.roles', 'r').where('r.code = :c', { c: '__super_admin_role__' }).getMany();
  if (natives.length !== 1) throw new Error(`Expected exactly one platform operator account, found ${natives.length}. Refusing to guess which to change.`);
  const native = natives[0]; const u = native.user; const repo = conn.rawConnection.getRepository(User);
  const changed = { identifier: u.identifier !== identifier, password: !(await cipher.check(password, native.passwordHash)) };
  if (changed.password) await conn.rawConnection.getRepository(NativeAuthenticationMethod).update(native.id, { passwordHash: await cipher.hash(password) });
  if (changed.identifier) { u.identifier = identifier; await repo.update(u.id, { identifier }); await conn.rawConnection.getRepository(Administrator).update({ user: { id: u.id } } as never, { emailAddress: identifier }); }
  return changed;
}
