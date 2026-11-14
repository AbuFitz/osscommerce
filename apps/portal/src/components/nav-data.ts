import { Home, Inbox, Tag, Boxes, Users, Percent, BarChart3, Store, Settings, LayoutGrid, Globe, FileText, LifeBuoy } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> };
export const commerce: NavItem[] = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/orders', label: 'Orders', icon: Inbox },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/discounts', label: 'Discounts', icon: Percent },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/storefront', label: 'Storefront', icon: Store },
  { href: '/settings', label: 'Settings', icon: Settings },
];
const by = (h: string) => commerce.find(c => c.href === h)!;
/** Grouping shown when the menu is expanded. The same order is used when collapsed. */
export const GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [by('/')] },
  { label: 'Sell', items: [by('/orders'), by('/products'), by('/inventory'), by('/customers')] },
  { label: 'Grow', items: [by('/discounts'), by('/analytics'), by('/storefront')] },
];
export const accountLink: NavItem = { href: '/account', label: 'Your OSS account', icon: LayoutGrid };
export const account: NavItem[] = [
  { href: '/account/website', label: 'Website', icon: Globe },
  { href: '/account/billing', label: 'Billing', icon: FileText },
  { href: '/account/support', label: 'Support', icon: LifeBuoy },
];
export const MORE_LINKS = [...commerce.slice(3), ...account];
export const PROGRESSIVE = ['/analytics', '/customers', '/discounts', '/inventory'];
