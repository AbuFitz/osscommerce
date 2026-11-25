import { Role, TransactionalConnection } from '@vendure/core';
import { MERCHANT_PERMISSIONS } from './merchant-role.ts';

/**
 * Keeps every store owner's role in step with the current merchant permission set, so a store created last month gets this month's features
 * without anyone re-running provisioning. Only roles the platform made for stores are touched (codes `owner-<store>` and `merchant-owner`);
 * the operator's role and any other role are left alone. Returns the codes that changed.
 */
export async function syncMerchantRoles(conn: TransactionalConnection): Promise<string[]> {
  const repo = conn.rawConnection.getRepository(Role); const want = [...MERCHANT_PERMISSIONS].map(String).sort(); const changed: string[] = [];
  for (const r of await repo.find()) {
    if (!(r.code === 'merchant-owner' || /^owner-.+/.test(r.code))) continue;
    if (JSON.stringify([...r.permissions].map(String).sort()) !== JSON.stringify(want)) { await repo.update(r.id, { permissions: [...MERCHANT_PERMISSIONS] }); changed.push(r.code); }
  }
  return changed;
}
