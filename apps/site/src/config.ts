import { LAUNCH_PLAN, COMMERCIAL_CONFIRMED } from '@oss-commerce/contracts';

/**
 * Single source of truth for facts that appear on the site and in legal pages.
 * Prices come from packages/contracts (the same data the platform reads), never from a page.
 */
export const SITE = {
  name: 'OneSimpleCommerce',
  maker: 'OneSimpleSite',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://commerce.onesimplesite.co.uk',
  makerUrl: 'https://onesimplesite.co.uk',
  /** The merchant sign-in. Unset until the production portal has a public address; the header hides the link rather than pointing somewhere wrong. */
  portalUrl: process.env.NEXT_PUBLIC_PORTAL_URL || null,
  email: 'hello@onesimplesite.co.uk', // published on onesimplesite.co.uk. A Commerce-specific address is still to be chosen.
  /** WhatsApp Business number as published by OneSimpleSite: 07732 420976. */
  whatsapp: { display: '07732 420976', href: 'https://wa.me/447732420976' },
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/onesimplesite/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/onesimplesite/' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@onesimplesite' },
  ],
} as const;

/** From the public Companies House record (company 17552675, checked 14 Nov 2026). VAT number and ICO registration are still unknown. */
export const COMPANY = {
  legalName: 'OneSimpleSite Ltd' as string | null,
  companyNumber: '17552675' as string | null,
  registeredAddress: '3f Foxhill, Watford, United Kingdom, WD24 6SX' as string | null,
  jurisdiction: 'England and Wales',
  vatNumber: null as string | null,
  icoRegistration: null as string | null,
};
export const COMPANY_REQUIRED = ['legalName', 'companyNumber', 'registeredAddress'] as const;
export const LEGAL = { reviewed: process.env.NEXT_PUBLIC_LEGAL_REVIEWED === '1', updated: '14 November 2026' };

const gbp = (minor: number) => (minor % 100 === 0 ? `£${minor / 100}` : `£${(minor / 100).toFixed(2)}`);
/** One plan. `confirmed` says what may be stated as fact; pages read it and soften or omit the rest. */
export const PRICE = {
  name: LAUNCH_PLAN.name,
  build: gbp(LAUNCH_PLAN.buildFromMinor), buildMinor: LAUNCH_PLAN.buildFromMinor,
  monthly: gbp(LAUNCH_PLAN.monthlyMinor), monthlyMinor: LAUNCH_PLAN.monthlyMinor,
  confirmed: COMMERCIAL_CONFIRMED,
} as const;

