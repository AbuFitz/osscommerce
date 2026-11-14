import { parse, Kind, OperationDefinitionNode, FieldNode } from 'graphql';

/** The public storefront surface. Anything not listed is refused, which keeps Admin-only and unknown fields out by construction.
 *  `private` fields need a shopper session; `public` ones are catalogue data and are safe to cache. */
export const PUBLIC_QUERIES = new Set(['activeChannel', 'product', 'products', 'collection', 'collections', 'facet', 'facets', 'search', 'eligibleCountries', 'availableCountries']);
export const PRIVATE_QUERIES = new Set(['activeOrder', 'activeCustomer', 'orderByCode', 'eligibleShippingMethods', 'eligiblePaymentMethods', 'nextOrderStates', 'me']);
export const MUTATIONS = new Set([
  'addItemToOrder', 'adjustOrderLine', 'removeOrderLine', 'removeAllOrderLines', 'applyCouponCode', 'removeCouponCode', 'setCustomerForOrder', 'setOrderShippingAddress', 'setOrderBillingAddress',
  'setOrderShippingMethod', 'setOrderCustomFields', 'transitionOrderToState', 'addPaymentToOrder',
  'registerCustomerAccount', 'verifyCustomerAccount', 'login', 'logout', 'requestPasswordReset', 'resetPassword', 'updateCustomer', 'updateCustomerPassword', 'requestUpdateCustomerEmailAddress', 'updateCustomerEmailAddress',
  'createCustomerAddress', 'updateCustomerAddress', 'deleteCustomerAddress',
]);
const PAYMENT = new Set(['addPaymentToOrder']);
export type Classified = { ok: true; kind: 'query' | 'mutation'; fields: string[]; needsSession: boolean; isPayment: boolean; cacheable: boolean } | { ok: false; reason: string };

export function classify(query: string, maxDepth = 12, maxLength = 20_000): Classified {
  if (query.length > maxLength) return { ok: false, reason: 'Query too large' };
  let doc; try { doc = parse(query); } catch { return { ok: false, reason: 'Invalid GraphQL' }; }
  const ops = doc.definitions.filter((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
  if (ops.length !== 1) return { ok: false, reason: 'Exactly one operation is allowed' };
  const op = ops[0]; if (op.operation === 'subscription') return { ok: false, reason: 'Subscriptions are not supported' };
  const depth = (n: any, d = 1): number => Math.max(d, ...(n.selectionSet?.selections ?? []).map((s: any) => depth(s, d + 1)));
  if (depth(op) > maxDepth) return { ok: false, reason: 'Query too deep' };
  const roots = op.selectionSet.selections;
  if (roots.some(s => s.kind !== Kind.FIELD)) return { ok: false, reason: 'Fragments at the root are not allowed' };
  const fields = (roots as FieldNode[]).map(f => f.name.value);
  if (fields.some(f => f.startsWith('__'))) return { ok: false, reason: 'Introspection is disabled' };
  const q = op.operation === 'query';
  const allowed = q ? [...PUBLIC_QUERIES, ...PRIVATE_QUERIES] : [...MUTATIONS];
  const bad = fields.find(f => !allowed.includes(f)); if (bad) return { ok: false, reason: `Operation not available: ${bad}` };
  const needsSession = fields.some(f => PRIVATE_QUERIES.has(f) || (!q && f !== 'registerCustomerAccount' && f !== 'requestPasswordReset' && f !== 'login' && f !== 'verifyCustomerAccount' && f !== 'resetPassword'));
  return { ok: true, kind: q ? 'query' : 'mutation', fields, needsSession: needsSession && !fields.every(f => ['addItemToOrder'].includes(f)), isPayment: fields.some(f => PAYMENT.has(f)), cacheable: q && fields.every(f => PUBLIC_QUERIES.has(f)) };
}
