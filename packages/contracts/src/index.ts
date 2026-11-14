import { z } from 'zod';

/** Stable identifiers owned by the shared identity/control plane. */
export const OrganisationId = z.string().min(1).brand<'OrganisationId'>();
export const StoreId = z.string().min(1).brand<'StoreId'>();
export const UserId = z.string().min(1).brand<'UserId'>();

export const StoreLifecycle = z.enum([
  'draft', 'provisioning', 'configuring', 'ready', 'live', 'restricted', 'suspended', 'offboarding', 'archived',
]);

/** Merchant roles; permissions are explicit operations, default deny. */
export const MerchantRole = z.enum(['owner', 'manager', 'fulfilment', 'analyst']);

export const Operation = z.enum([
  'catalogue.read', 'catalogue.write', 'orders.read', 'orders.fulfil', 'orders.refund',
  'customers.read', 'inventory.write', 'discounts.write', 'analytics.read',
  'settings.write', 'payments.connect', 'team.manage',
]);
export type Operation = z.infer<typeof Operation>;

export const ROLE_OPERATIONS: Record<z.infer<typeof MerchantRole>, readonly Operation[]> = {
  owner: Operation.options,
  manager: ['catalogue.read', 'catalogue.write', 'orders.read', 'orders.fulfil', 'orders.refund', 'customers.read', 'inventory.write', 'discounts.write', 'analytics.read'],
  fulfilment: ['orders.read', 'orders.fulfil'],
  analyst: ['analytics.read'],
};

/** Manage -> Commerce: emitted when a signed contract grants commerce. Idempotent on `eventId`. */
export const EntitlementGranted = z.object({
  eventId: z.string().uuid(),
  type: z.literal('entitlement.commerce.granted'),
  occurredAt: z.string().datetime(),
  organisationId: OrganisationId,
  contractRef: z.string(),
  entitlementVersion: z.number().int().nonnegative(),
  plan: z.string(),
});

/** Store registry row. Contains no secrets. */
export const StoreRecord = z.object({
  storeId: StoreId,
  organisationId: OrganisationId,
  cellId: z.string(),
  hostnames: z.array(z.object({ host: z.string(), verified: z.boolean() })),
  region: z.enum(['eu-west-london', 'eu-west-ireland']),
  lifecycle: StoreLifecycle,
  entitlementVersion: z.number().int(),
  paymentReadiness: z.enum(['not_started', 'onboarding', 'restricted', 'enabled']),
});
export type StoreRecord = z.infer<typeof StoreRecord>;

/** Authorisation is membership + operation + resource owner, on every server call. */
export function can(role: z.infer<typeof MerchantRole>, op: Operation): boolean {
  return ROLE_OPERATIONS[role].includes(op);
}

export const LAUNCH_GATES = ['contract_signed', 'payments_enabled', 'domain_verified', 'test_order_passed', 'launch_approved'] as const;
export type LaunchGate = (typeof LAUNCH_GATES)[number];

export * from './plans';
