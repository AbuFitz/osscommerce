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

/** Not published anywhere we could read. Legal pages show a visible draft notice until these are supplied and reviewed. */
export const COMPANY = {
  legalName: null as string | null,
  companyNumber: null as string | null,
  registeredAddress: null as string | null,
  vatNumber: null as string | null,
  icoRegistration: null as string | null,
};
export const LEGAL = {
  /** Set NEXT_PUBLIC_LEGAL_REVIEWED=1 only after a solicitor has approved the documents. */
  reviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === '1',
  updated: '14 November 2026',
};

/** Pilot pricing. `provisional`: planning figures from the research pack, not yet agreed. Confirm before publishing. */
export const PRICING = {
  status: 'provisional' as const,
  monthlyGbp: 50,       // ex VAT
  platformFeeBp: 50,    // 0.5% of captured payments
  vatRate: 0.2,
};

export const NAV = [
  { href: '/storefronts', label: 'Storefronts' },
  { href: '/#tour', label: 'The platform' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
] as const;
