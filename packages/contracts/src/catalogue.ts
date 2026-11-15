// Product, option and variant rules shared by the portal and the cell. Our own code: no engine imports, so nothing GPL crosses the boundary.
export type TaxClass = 'standard' | 'reduced' | 'zero';
export interface OptionGroup { name: string; options: string[] }
export interface VariantDraft { options: string[]; sku: string; priceMinor: number; stock: number; taxClass?: TaxClass; enabled?: boolean; weightGrams?: number }
export interface ProductDraft { title: string; slug?: string; description?: string; enabled?: boolean; optionGroups: OptionGroup[]; variants: VariantDraft[] }

export const TAX_CATEGORY_NAME: Record<TaxClass, string> = { standard: 'Standard', reduced: 'Reduced', zero: 'Zero' };
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const code = (s: string) => slugify(s);

/** Validates before anything is sent: every variant picks exactly one option per group, and combinations are unique. */
export function validateDraft(d: ProductDraft): string[] {
  const e: string[] = []; if (!d.title.trim()) e.push('A product needs a name.'); if (!d.variants.length) e.push('A product needs at least one variant.');
  const seen = new Set<string>(); const skus = new Set<string>();
  for (const v of d.variants) {
    if (v.options.length !== d.optionGroups.length) e.push(`${v.sku}: choose one value for each of ${d.optionGroups.map(g => g.name).join(', ') || 'no options'}.`);
    d.optionGroups.forEach((g, i) => { if (v.options[i] && !g.options.includes(v.options[i])) e.push(`${v.sku}: "${v.options[i]}" is not a ${g.name} option.`); });
    const k = v.options.join('|'); if (seen.has(k)) e.push(`${v.sku}: this combination already exists.`); seen.add(k);
    if (skus.has(v.sku)) e.push(`SKU ${v.sku} is used twice.`); skus.add(v.sku); if (!(v.priceMinor >= 0)) e.push(`${v.sku}: price must be zero or more.`); if (!(v.stock >= 0)) e.push(`${v.sku}: stock cannot be negative.`);
  }
  return e;
}
/** Every combination of the option groups, for the "generate variants" button. */
export const combinations = (groups: OptionGroup[]): string[][] => groups.reduce<string[][]>((acc, g) => acc.flatMap(a => g.options.map(o => [...a, o])), [[]]);

