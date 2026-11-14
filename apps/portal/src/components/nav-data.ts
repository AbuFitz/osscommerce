import { Home, Inbox, Tag, Boxes, Users, Percent, BarChart3, Store, Settings, LayoutGrid, Globe, FileText, LifeBuoy } from 'lucide-react';

export const commerce = [
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
/** Owned by OSS Manage. One account, so these sit in the same shell. */
export const accountLink = { href: '/account', label: 'Your OSS account', icon: LayoutGrid };
export const account = [
  { href: '/account/website', label: 'Website', icon: Globe },
  { href: '/account/billing', label: 'Billing', icon: FileText },
  { href: '/account/support', label: 'Support', icon: LifeBuoy },
];
export const MORE_LINKS = [...commerce.slice(3), ...account];
