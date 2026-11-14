import { Home, Inbox, Tag, Boxes, Users, Settings, Globe, FileText, LifeBuoy } from 'lucide-react';

export const commerce = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/orders', label: 'Orders', icon: Inbox },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];
/** Owned by OSS Manage; shown here so there is one account. Links leave the commerce app. */
export const account = [
  { href: '/account/website', label: 'Website', icon: Globe },
  { href: '/account/billing', label: 'Billing', icon: FileText },
  { href: '/account/support', label: 'Support', icon: LifeBuoy },
];

export const MORE_LINKS = [commerce[3], commerce[4], commerce[5], ...account];
