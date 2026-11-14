import { Home, Inbox, Tag, Boxes, Users, Percent, BarChart3, Store, Settings, LayoutGrid, Globe, FileText, LifeBuoy, Workflow, PenLine } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> };
export const commerce: NavItem[] = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/orders', label: 'Orders', icon: Inbox },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/discounts', label: 'Discounts', icon: Percent },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/automations', label: 'Automations', icon: Workflow },
  { href: '/storefront', label: 'Storefront', icon: Store },
  { href: '/content', label: 'Content', icon: PenLine },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const by = (h: string) => commerce.find(c => c.href === h)!;
/** Grouping shown when the menu is expanded. The same order is used when collapsed. */
export const GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [by('/')] },
  { label: 'Sell', items: [by('/orders'), by('/products'), by('/inventory'), by('/customers')] },
  { label: 'Grow', items: [by('/discounts'), by('/analytics'), by('/automations')] },
  { label: 'Store', items: [by('/storefront'), by('/content'), by('/support')] },
];
const SETTINGS = by('/settings');
export { SETTINGS };
export const accountLink: NavItem = { href: '/account', label: 'Your OSS account', icon: LayoutGrid };
export const account: NavItem[] = [
  { href: '/account/website', label: 'Website', icon: Globe },
  { href: '/account/billing', label: 'Billing', icon: FileText },
  { href: '/account/support', label: 'Support', icon: LifeBuoy },
];
export const MORE_LINKS = [by('/inventory'), by('/customers'), by('/discounts'), by('/analytics'), by('/automations'), by('/storefront'), by('/content'), by('/support'), SETTINGS, ...account.filter(a => a.href !== '/account/support')];
export const PROGRESSIVE = ['/analytics', '/customers', '/discounts', '/inventory'];
