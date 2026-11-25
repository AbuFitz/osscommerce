const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
export const money = (minor: number) => gbp.format(minor / 100);
export const moneyShort = (minor: number) => gbp0.format(minor / 100);
export const when = (iso: string) => !iso || Number.isNaN(Date.parse(iso)) ? '' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));
export const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }).format(new Date(iso));
/** "2 h ago" relative to a fixed reference time (the server's), so server and browser render the same text. */
export const ago = (iso: string, ref: string) => { const s = Math.max(0, (Date.parse(ref) - Date.parse(iso)) / 1000); if (!Number.isFinite(s)) return ''; if (s < 90) return 'just now'; const m = s / 60; if (m < 60) return `${Math.round(m)} min ago`; const h = m / 60; if (h < 36) return `${Math.round(h)} h ago`; return `${Math.round(h / 24)} days ago`; };
