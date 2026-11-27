import { Home, Inbox, Tag, Boxes, Users, Percent, BarChart3, Store, Settings, LayoutGrid, Globe, FileText, LifeBuoy, Workflow, PenLine, Layers, Star } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> };
export const commerce: NavItem[] = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/orders', label: 'Orders', icon: Inbox },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/collections', label: 'Collections', icon: Layers },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/discounts', label: 'Discounts', icon: Percent },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/storefront', label: 'Storefront', icon: Store },
  { href: '/content', label: 'Content', icon: PenLine },
  { href: '/support', label: 'Help', icon: LifeBuoy },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const by = (h: string) => commerce.find(c => c.href === h)!;
/** Grouping shown when the menu is expanded. The same order is used when collapsed. */
export const GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [by('/')] },
  { label: 'Sell', items: [by('/orders'), by('/products'), by('/collections'), by('/reviews'), by('/inventory'), by('/customers')] },
  { label: 'Grow', items: [by('/discounts'), by('/analytics'), by('/automations')] },
  { label: 'Website', items: [by('/storefront'), by('/content')] },
];
/** Pinned to the bottom of the menu, in this order: help, settings, then the profile menu (plan and billing, team, preferences). */
export const HELP = by('/support');
const SETTINGS = by('/settings');
export { SETTINGS };
export const account: NavItem[] = [{ href: '/account/billing', label: 'Plan and billing', icon: FileText }];
export const MORE_LINKS = [by('/collections'), by('/inventory'), by('/customers'), by('/discounts'), by('/analytics'), by('/automations'), by('/storefront'), by('/content'), HELP, SETTINGS, ...account];
export const PROGRESSIVE = ['/analytics', '/customers', '/discounts', '/inventory'];

/** Second-level links shown under their parent when the menu is expanded and that section is open. Collections and Inventory live under Products when expanded; the icon rail still lists them. */
export const CHILDREN: Record<string, { href: string; label: string }[]> = {
  '/orders': [{ href: '/orders?filter=unfulfilled', label: 'To fulfil' }, { href: '/orders?filter=refunded', label: 'Refunds' }, { href: '/orders/abandoned', label: 'Abandoned checkouts' }],
  '/products': [{ href: '/collections', label: 'Collections' }, { href: '/inventory', label: 'Inventory' }],
  '/analytics': [{ href: '/analytics/live', label: 'Live view' }],
};
export const NESTED = new Set(['/collections', '/inventory']);
