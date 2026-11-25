import { Permission, PermissionDefinition } from '@vendure/core';
/** Two permissions of our own: who may manage staff, and who may read the activity log. Only owners hold ManageStaff; managers may read activity. */
export const ManageStaff = new PermissionDefinition({ name: 'ManageStaff', description: 'Invite, change and remove staff in this store' });
export const ReadActivity = new PermissionDefinition({ name: 'ReadActivity', description: 'See who did what in this store' });
const MANAGE_STAFF = 'ManageStaff' as Permission; const READ_ACTIVITY = 'ReadActivity' as Permission;
/** What a merchant may do in their own store. Deliberately not SuperAdmin: no settings, roles, channels, administrators or system access. */
export const MERCHANT_PERMISSIONS = [Permission.ReadCatalog, Permission.CreateCatalog, Permission.UpdateCatalog, Permission.DeleteCatalog, Permission.ReadOrder, Permission.CreateOrder, Permission.UpdateOrder, Permission.DeleteOrder, Permission.ReadCustomer, Permission.UpdateCustomer,
  Permission.ReadPromotion, Permission.CreatePromotion, Permission.UpdatePromotion, Permission.DeletePromotion, Permission.ReadSettings, Permission.CreateSettings, Permission.UpdateSettings, Permission.DeleteSettings, Permission.ReadAsset, Permission.CreateAsset, Permission.UpdateAsset, Permission.DeleteAsset, MANAGE_STAFF, READ_ACTIVITY];

/** The roles an owner can give to staff. Each is a fixed template, so an owner can never hand out more than these, and never the owner's own powers. */
export type StaffRole = 'manager' | 'fulfilment' | 'analyst';
// Vendure adds the baseline `Authenticated` permission to every role it creates; roles we write ourselves must carry it too, or the person cannot use any endpoint that only needs a sign-in.
const withAuth = (p: Permission[]): Permission[] => [Permission.Authenticated, ...p.filter(x => x !== Permission.Authenticated)];
export const STAFF_ROLES: Record<StaffRole, { label: string; description: string; permissions: Permission[] }> = {
  manager: { label: 'Manager', description: 'Products, orders, customers, discounts, stock and photos. Cannot change delivery or payment settings, or manage staff.',
    permissions: withAuth(MERCHANT_PERMISSIONS.filter(p => p !== MANAGE_STAFF && p !== Permission.CreateSettings && p !== Permission.UpdateSettings && p !== Permission.DeleteSettings)) },
  fulfilment: { label: 'Fulfilment', description: 'Sees orders and customers, marks orders fulfilled and adds notes. Cannot edit products, prices or settings.', permissions: withAuth([Permission.ReadOrder, Permission.UpdateOrder, Permission.ReadCatalog, Permission.ReadCustomer, Permission.ReadAsset]) },
  analyst: { label: 'View only', description: 'Can look at orders, products, customers and discounts. Cannot change anything.', permissions: withAuth([Permission.ReadCatalog, Permission.ReadOrder, Permission.ReadCustomer, Permission.ReadPromotion, Permission.ReadAsset]) },
};
export const isStaffRole = (r: string): r is StaffRole => r === 'manager' || r === 'fulfilment' || r === 'analyst';
/** The permissions a role code should hold, or null if it is not one of ours. Codes are `owner-<store>`, `manager-<store>`, `fulfilment-<store>`, `analyst-<store>` (and the older `merchant-owner`). */
export function permissionsForRoleCode(code: string): Permission[] | null {
  if (code === 'merchant-owner' || /^owner-.+/.test(code)) return withAuth(MERCHANT_PERMISSIONS);
  const m = /^(manager|fulfilment|analyst)-.+/.exec(code); return m ? STAFF_ROLES[m[1] as StaffRole].permissions : null;
}
