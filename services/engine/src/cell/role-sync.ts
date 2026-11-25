import { Role, TransactionalConnection } from '@vendure/core';
import { permissionsForRoleCode } from './merchant-role.ts';

/**
 * Keeps every store owner's role in step with the current merchant permission set, so a store created last month gets this month's features
 * without anyone re-running provisioning. Only roles the platform made for stores are touched (codes `owner-<store>`, `manager-<store>`, `fulfilment-<store>`, `analyst-<store>` and `merchant-owner`);
 * the operator's role and any other role are left alone. Returns the codes that changed.
 */
export async function syncMerchantRoles(conn: TransactionalConnection): Promise<string[]> {
  const repo = conn.rawConnection.getRepository(Role); const changed: string[] = [];
  for (const r of await repo.find()) {
    const perms = permissionsForRoleCode(r.code); if (!perms) continue;
    const want = [...perms].map(String).sort();
    if (JSON.stringify([...r.permissions].map(String).sort()) !== JSON.stringify(want)) { await repo.update(r.id, { permissions: [...perms] }); changed.push(r.code); }
  }
  return changed;
}
