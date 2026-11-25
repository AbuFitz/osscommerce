import type { Member } from './gateway';

/**
 * What each role is shown. This only tidies the screen: the engine refuses anything the role is not allowed, whatever the page shows.
 * Owners see everything. A role never sees a link that would only lead to "not allowed".
 */
type Kind = Member['role'];
const STORE_ONLY = ['/settings/payments', '/settings/shipping', '/settings/preferences', '/settings/emails', '/settings/legal', '/settings/integrations', '/account/billing', '/settings/activity'];
const HIDDEN: Record<Kind, string[]> = {
  owner: [],
  manager: ['/settings/payments', '/settings/shipping', '/account/billing'],
  fulfilment: ['/products', '/collections', '/discounts', '/analytics', '/automations', '/storefront', '/content', ...STORE_ONLY],
  analyst: ['/automations', '/storefront', '/content', ...STORE_ONLY],
};
export const hiddenFor = (kind: Kind): string[] => HIDDEN[kind] ?? [];
export const canSee = (kind: Kind, href: string) => !hiddenFor(kind).some(h => href === h || href.startsWith(h + '/'));
