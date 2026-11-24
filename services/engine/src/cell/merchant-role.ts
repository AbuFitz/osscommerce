import { Permission } from '@vendure/core';
/** What a merchant may do in their own store. Deliberately not SuperAdmin: no settings, roles, channels, administrators or system access. */
export const MERCHANT_PERMISSIONS = [Permission.ReadCatalog, Permission.CreateCatalog, Permission.UpdateCatalog, Permission.DeleteCatalog, Permission.ReadOrder, Permission.UpdateOrder, Permission.ReadCustomer, Permission.UpdateCustomer,
  Permission.ReadPromotion, Permission.CreatePromotion, Permission.UpdatePromotion, Permission.DeletePromotion, Permission.ReadSettings, Permission.CreateSettings, Permission.UpdateSettings, Permission.DeleteSettings, Permission.ReadAsset, Permission.CreateAsset, Permission.UpdateAsset, Permission.DeleteAsset];
