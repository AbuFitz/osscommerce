/** Maps the portal's product model onto the engine's Admin API. The executor is a port, so the same code runs against the test harness and, later, the real HTTP gateway. */
export type UploadFile = { name: string; type: string; bytes: Uint8Array };
/** GraphQL call. `upload` sends the same kind of call with files attached (GraphQL multipart request); each file is placed at the variable path given in `paths`. */
export type Exec = ((query: string, variables?: Record<string, unknown>) => Promise<any>) & { upload?: (query: string, variables: Record<string, unknown>, files: { path: string; file: UploadFile }[]) => Promise<any> };
import { slugify, code, TAX_CATEGORY_NAME, validateDraft, combinations, type TaxClass, type OptionGroup, type VariantDraft, type ProductDraft } from '@oss-commerce/contracts';
export { validateDraft, combinations };
export type { TaxClass, OptionGroup, VariantDraft, ProductDraft };
export async function ensureTaxCategories(x: Exec): Promise<Record<TaxClass, string>> {
  const have = (await x('query{ taxCategories{ items{ id name } } }')).taxCategories.items as { id: string; name: string }[]; const out = {} as Record<TaxClass, string>;
  for (const k of Object.keys(TAX_CATEGORY_NAME) as TaxClass[]) { const f = have.find(t => t.name === TAX_CATEGORY_NAME[k]); out[k] = f ? f.id : (await x('mutation($n:String!){ createTaxCategory(input:{name:$n}){ id } }', { n: TAX_CATEGORY_NAME[k] })).createTaxCategory.id; }
  return out;
}

/** Tax categories are GLOBAL in Vendure (shared by every store on the engine), so a merchant must never create them. Provisioning creates them once with ensureTaxCategories; merchants only look them up. */
export async function findTaxCategories(x: Exec): Promise<Record<TaxClass, string>> {
  const have = (await x('query{ taxCategories{ items{ id name } } }')).taxCategories.items as { id: string; name: string }[]; const out = {} as Record<TaxClass, string>;
  for (const k of Object.keys(TAX_CATEGORY_NAME) as TaxClass[]) { const f = have.find(t => t.name === TAX_CATEGORY_NAME[k]); if (!f) throw new Error('This store has not been fully set up yet (VAT classes are missing). Contact support.'); out[k] = f.id; }
  return out;
}

export async function createProductWithVariants(x: Exec, d: ProductDraft) {
  const problems = validateDraft(d); if (problems.length) throw new Error(problems.join(' '));
  const tax = await findTaxCategories(x);
  const product = (await x(`mutation($i: CreateProductInput!){ createProduct(input:$i){ id } }`, { i: { enabled: d.enabled ?? false, translations: [{ languageCode: 'en', name: d.title.trim(), slug: d.slug ?? slugify(d.title), description: d.description ?? '' }], customFields: { seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null } } })).createProduct.id as string;
  const groupIds: string[] = [];
  for (const g of d.optionGroups) {
    const gid = (await x(`mutation($i: CreateProductOptionGroupInput!){ createProductOptionGroup(input:$i){ id } }`, { i: { code: `${code(d.title)}-${code(g.name)}`, translations: [{ languageCode: 'en', name: g.name }], options: g.options.map(o => ({ code: code(o), translations: [{ languageCode: 'en', name: o }] })) } })).createProductOptionGroup.id as string;
    await x(`mutation($p:ID!,$g:ID!){ addOptionGroupToProduct(productId:$p, optionGroupId:$g){ id } }`, { p: product, g: gid }); groupIds.push(gid);
  }
  const groups = (await x(`query($id:ID!){ product(id:$id){ optionGroups{ id name options{ id code name } } } }`, { id: product })).product.optionGroups as { id: string; name: string; options: { id: string; name: string }[] }[];
  const input = d.variants.map(v => ({
    productId: product, sku: v.sku, price: v.priceMinor, taxCategoryId: tax[v.taxClass ?? 'standard'], trackInventory: 'TRUE', stockOnHand: v.stock, enabled: v.enabled ?? true,
    optionIds: d.optionGroups.map((g, i) => groups.find(q => q.name === g.name)!.options.find(o => o.name === v.options[i])!.id), customFields: { weightGrams: v.weightGrams ?? 0, compareAtPrice: v.compareAtMinor || null, barcode: v.barcode || null }, translations: [{ languageCode: 'en', name: [d.title.trim(), ...v.options].join(' ') }],
  }));
  await x(`mutation($i:[CreateProductVariantInput!]!){ createProductVariants(input:$i){ id } }`, { i: input });
  return product;
}

/** A collection is a rule over the catalogue. `variant-name-filter` and `facet-value-filter` are the engine's own filters. */
export type Rule = { kind: 'name'; contains: string } | { kind: 'facet'; facetValueIds: string[] };
export async function createCollection(x: Exec, name: string, rule: Rule) {
  const filter = rule.kind === 'name' ? { code: 'variant-name-filter', arguments: [{ name: 'operator', value: 'contains' }, { name: 'term', value: rule.contains }] } : { code: 'facet-value-filter', arguments: [{ name: 'facetValueIds', value: JSON.stringify(rule.facetValueIds) }, { name: 'containsAny', value: 'true' }] };
  return (await x(`mutation($i: CreateCollectionInput!){ createCollection(input:$i){ id } }`, { i: { filters: [filter], translations: [{ languageCode: 'en', name, slug: slugify(name), description: '' }] } })).createCollection.id as string;
}
export async function previewCollection(x: Exec, rule: Rule) {
  const filter = rule.kind === 'name' ? { code: 'variant-name-filter', arguments: [{ name: 'operator', value: 'contains' }, { name: 'term', value: rule.contains }] } : { code: 'facet-value-filter', arguments: [{ name: 'facetValueIds', value: JSON.stringify(rule.facetValueIds) }, { name: 'containsAny', value: 'true' }] };
  return (await x(`query($f:[ConfigurableOperationInput!]!){ previewCollectionVariants(input:{parentId:null, inheritFilters:false, filters:$f}){ totalItems items{ sku name } } }`, { f: [filter] })).previewCollectionVariants as { totalItems: number; items: { sku: string; name: string }[] };
}
