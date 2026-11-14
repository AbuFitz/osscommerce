/** Build-time flag. Demo fixtures, the demo view switcher and demo wording exist only when this is '1'. */
export const DEMO = process.env.NEXT_PUBLIC_OSS_DEMO === '1';
export const MANAGE_URL = process.env.NEXT_PUBLIC_OSS_MANAGE_URL ?? '';
