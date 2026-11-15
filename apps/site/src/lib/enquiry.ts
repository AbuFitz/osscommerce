import { z } from 'zod';

export const SELLING = [['not_yet', 'Not selling online yet'], ['own_site', 'On my own website'], ['marketplace', 'On a marketplace such as Etsy or eBay'], ['in_person', 'In person only'], ['other', 'Something else']] as const;
export const RANGE = [['1-10', '1 to 10 products'], ['11-50', '11 to 50'], ['51-250', '51 to 250'], ['250+', 'More than 250'], ['unsure', 'Not sure yet']] as const;

const opt = (max: number) => z.string().trim().max(max).optional().transform(v => v || undefined);
/** One schema for the browser and the server, so they can never disagree about what is valid. */
export const Enquiry = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  phone: opt(40),
  business: z.string().trim().min(1, 'Enter your business name.').max(160),
  website: opt(300),
  sellingNow: z.enum(['not_yet', 'own_site', 'marketplace', 'in_person', 'other']),
  productRange: z.enum(['1-10', '11-50', '51-250', '250+', 'unsure']),
  message: opt(4000),
});
export type Enquiry = z.infer<typeof Enquiry>;
export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>;
export const errorsOf = (e: z.ZodError): EnquiryErrors => Object.fromEntries(e.issues.map(i => [i.path[0], i.message]));
