import { z, ZodTypeAny } from 'zod';

/** Content manifest: each bespoke storefront declares the editable parts of its design. The portal renders editors from it,
 *  the storefront validates published content against it. Merchants edit values, never markup, so the design cannot be broken. */
const Base = { label: z.string().min(1), help: z.string().optional(), required: z.boolean().default(false) };
export const Field: z.ZodType<any> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({ ...Base, type: z.literal('text'), max: z.number().int().positive().default(200), multiline: z.boolean().default(false) }),
  z.object({ ...Base, type: z.literal('richtext'), max: z.number().int().positive().default(5000) }),     // restricted: paragraphs, bold, italic, links, lists. Never raw HTML.
  z.object({ ...Base, type: z.literal('image'), aspect: z.string().regex(/^\d+:\d+$/).optional(), minWidth: z.number().int().optional(), altRequired: z.boolean().default(true) }),
  z.object({ ...Base, type: z.literal('link') }),
  z.object({ ...Base, type: z.literal('boolean') }),
  z.object({ ...Base, type: z.literal('select'), options: z.array(z.string()).min(1) }),
  z.object({ ...Base, type: z.literal('productRef'), max: z.number().int().positive().default(1) }),
  z.object({ ...Base, type: z.literal('collectionRef') }),
  z.object({ ...Base, type: z.literal('list'), min: z.number().int().default(0), max: z.number().int().positive().default(12), of: z.record(Field) }),
]));
export const Manifest = z.object({ version: z.number().int().positive(), entries: z.record(z.object({ label: z.string(), singleton: z.boolean().default(true), fields: z.record(Field) })) });
export type Manifest = z.infer<typeof Manifest>;

const SAFE_URL = /^(https:\/\/|\/(?!\/)|mailto:|tel:)/;
export const ImageValue = z.object({ assetId: z.string().min(1), alt: z.string().max(200).optional() });
export const LinkValue = z.object({ label: z.string().min(1).max(80), href: z.string().max(500).refine(u => SAFE_URL.test(u), 'Links must be https, relative, mailto or tel') });

function fieldSchema(f: any): ZodTypeAny {
  let s: ZodTypeAny;
  switch (f.type) {
    case 'text': s = z.string().max(f.max).refine(v => f.multiline || !/\n/.test(v), 'Single line only'); break;
    case 'richtext': s = z.string().max(f.max).refine(v => !/<\s*(script|iframe|style|object|embed)\b|\son\w+\s*=|javascript:/i.test(v), 'Unsafe markup'); break;
    case 'image': s = f.altRequired ? ImageValue.extend({ alt: z.string().min(1).max(200) }) : ImageValue; break;
    case 'link': s = LinkValue; break;
    case 'boolean': s = z.boolean(); break;
    case 'select': s = z.enum(f.options as [string, ...string[]]); break;
    case 'productRef': s = z.array(z.string().min(1)).max(f.max); break;
    case 'collectionRef': s = z.string().min(1); break;
    case 'list': s = z.array(z.object(Object.fromEntries(Object.entries(f.of).map(([k, v]) => [k, fieldSchema(v)])))).min(f.min).max(f.max); break;
    default: throw new Error('Unknown field type');
  }
  return f.required ? s : s.optional();
}
export function compileEntry(m: Manifest, entry: string) {
  const e = m.entries[entry]; if (!e) throw new Error(`Unknown content entry: ${entry}`);
  return z.object(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, fieldSchema(v)]))).strict();     // unknown keys are rejected, so stale fields cannot linger silently
}
export function validateEntry(m: Manifest, entry: string, body: unknown): { ok: true; value: any } | { ok: false; errors: { path: string; message: string }[] } {
  const r = compileEntry(m, entry).safeParse(body);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) };
}

/** When a storefront's design changes, its manifest changes. A change is breaking if existing published content could stop validating. */
export function diffManifests(a: Manifest, b: Manifest): { breaking: string[]; additive: string[] } {
  const breaking: string[] = [], additive: string[] = [];
  const walk = (path: string, x: Record<string, any>, y: Record<string, any>) => {
    for (const k of Object.keys(x)) {
      if (!(k in y)) { breaking.push(`${path}${k} removed`); continue; }
      if (x[k].type !== y[k].type) { breaking.push(`${path}${k} changed type ${x[k].type} to ${y[k].type}`); continue; }
      if (!x[k].required && y[k].required) breaking.push(`${path}${k} became required`);
      if (x[k].type === 'select' && x[k].options.some((o: string) => !y[k].options.includes(o))) breaking.push(`${path}${k} lost options`);
      if (x[k].type === 'text' && y[k].max < x[k].max) breaking.push(`${path}${k} shortened`);
      if (x[k].type === 'list') { if (y[k].max < x[k].max) breaking.push(`${path}${k} max reduced`); walk(`${path}${k}.`, x[k].of, y[k].of); }
    }
    for (const k of Object.keys(y)) if (!(k in x)) (y[k].required ? breaking : additive).push(`${path}${k} added${y[k].required ? ' as required' : ''}`);
  };
  for (const e of Object.keys(a.entries)) { if (!b.entries[e]) breaking.push(`entry ${e} removed`); else walk(`${e}.`, a.entries[e].fields, b.entries[e].fields); }
  for (const e of Object.keys(b.entries)) if (!a.entries[e]) additive.push(`entry ${e} added`);
  return { breaking, additive };
}
