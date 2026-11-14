import { z } from 'zod';

/** Every provider is described by a manifest before any code for it exists. The portal renders discovery, wizards and status from it,
 *  and the catalogue refuses to mark a provider `available` until the evidence below is true: real docs, sandbox proof, provider
 *  approval where needed, supported regions and pricing checked. */
export const Category = z.enum(['payments', 'tax', 'shipping', 'address', 'search', 'media', 'fulfilment', 'print_on_demand', 'identifiers', 'automation']);
export const Auth = z.discriminatedUnion('type', [
  z.object({ type: z.literal('platform') }),                                                     // OSS holds the platform credential (Stripe Connect)
  z.object({ type: z.literal('oauth'), scopes: z.array(z.string()) }),
  z.object({ type: z.literal('api_key'), fields: z.array(z.object({ key: z.string(), label: z.string(), secret: z.boolean() })).min(1) }),
  z.object({ type: z.literal('none') }),
]);
export const Evidence = z.object({
  docsReviewed: z.boolean(), sandboxVerified: z.boolean(), providerApproved: z.boolean().or(z.literal('not_required')),
  regionsVerified: z.boolean(), pricingChecked: z.boolean(), securityTested: z.boolean(), failureHandlingTested: z.boolean(),
});
export const Manifest = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/), name: z.string(), category: Category, summary: z.string().max(160), docsUrl: z.string().url(),
  regions: z.array(z.string().length(2)).min(1), auth: Auth,
  capabilities: z.array(z.enum(['accept_payment', 'wallets', 'bnpl', 'tax_calculation', 'rates', 'labels', 'tracking', 'address_lookup', 'postcode_validation', 'product_search', 'image_transform', 'inventory_sync', 'order_submission', 'barcodes'])).min(1),
  cost: z.object({ payer: z.enum(['merchant', 'oss', 'none']), note: z.string() }),                // provider costs are disclosed, never absorbed silently
  webhooks: z.boolean(), entitlement: z.string().optional(), dependsOn: z.array(z.string()).default([]),
  /** Hosts the adapter may call. Anything else is refused (SSRF guard). */
  allowedHosts: z.array(z.string()).default([]),
  rateLimit: z.object({ perMinute: z.number().int().positive() }).optional(),
  availability: z.enum(['research', 'planned', 'building', 'available']), evidence: Evidence, notes: z.string().optional(),
});
export type Manifest = z.infer<typeof Manifest>;

/** The only route to `available`. */
export function readyToAdvertise(m: Manifest): { ok: boolean; missing: string[] } {
  const e = m.evidence, missing: string[] = [];
  if (!e.docsReviewed) missing.push('provider documentation reviewed'); if (!e.sandboxVerified) missing.push('sandbox proof'); if (e.providerApproved === false) missing.push('provider approval');
  if (!e.regionsVerified) missing.push('supported regions verified'); if (!e.pricingChecked) missing.push('pricing checked'); if (!e.securityTested) missing.push('security tests'); if (!e.failureHandlingTested) missing.push('failure handling tests');
  return { ok: missing.length === 0, missing };
}
