/**
 * Single source of truth for facts that appear on the site and in legal pages.
 * Anything marked `provisional` or `null` must be confirmed before launch.
 */
export const SITE = {
  name: 'OneSimpleSite',
  product: 'Commerce',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://commerce.onesimplesite.co.uk',
  agencyUrl: 'https://onesimplesite.co.uk',
  email: 'hello@onesimplesite.co.uk', // published on onesimplesite.co.uk
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/onesimplesite/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/onesimplesite/' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@onesimplesite' },
    { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61587530671229' },
  ],
} as const;

/** From the public Companies House record (company 17552675, checked 14 Nov 2026). Company-level details only.
 *  Still unknown: VAT number and ICO registration. As a data controller the company should hold an ICO data protection fee registration; confirm. */
export const COMPANY = {
  legalName: 'OneSimpleSite Ltd' as string | null,
  companyNumber: '17552675' as string | null,
  registeredAddress: '3f Foxhill, Watford, United Kingdom, WD24 6SX' as string | null,
  jurisdiction: 'England and Wales',
  vatNumber: null as string | null,
  icoRegistration: null as string | null,
};
/** Required identity fields. VAT and ICO numbers are shown only when present. */
export const COMPANY_REQUIRED = ['legalName', 'companyNumber', 'registeredAddress'] as const;
export const LEGAL = {
  /** Set NEXT_PUBLIC_LEGAL_REVIEWED=1 only after a solicitor has approved the documents. */
  reviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === '1',
  updated: '14 November 2026',
};

/**
 * Intended starting prices, from the product brief. Provisional until infrastructure cost, Stripe Connect fees and entitlements are validated.
 * Pricing, entitlements and fees must be managed in the internal platform (see packages/contracts/src/plans.ts), not hardcoded in pages.
 */
export const PRICING = {
  status: 'provisional' as const,
  vatRate: 0.2,
  plans: [
    {
      id: 'commerce', name: 'OSS Commerce', monthly: 49.99, buildFrom: 699, commissionBp: 50 as number | null, commissionNote: 'of captured payments, on top of payment processing fees',
      includes: ['The OSS Commerce platform and merchant dashboard', 'Managed hosting and infrastructure', 'Security, monitoring and platform maintenance', 'Payment infrastructure and essential integrations', 'Defined technical support', 'Standard platform updates and improvements'],
    },
    {
      id: 'plus', name: 'OSS Commerce Plus', monthly: 99, buildFrom: 1499, commissionBp: 30 as number | null, commissionNote: 'of captured payments, falling to 0.2% above £100,000 a month. Payment processing fees are separate',
      includes: ['Everything in OSS Commerce', 'Advanced reporting', 'Additional automation', 'Higher usage allowances', 'More advanced team and inventory features', 'Priority technical support'],
    },
  ],
} as const;

export const NAV = [
  { href: '/storefronts', label: 'Storefronts' },
  { href: '/#dashboard', label: 'The platform' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;
