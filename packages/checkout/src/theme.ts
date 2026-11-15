/** Merchant branding for Stripe's elements: a few brand tokens in, a Stripe Appearance out. The shared flow stays identical; only the skin changes. */
export interface Brand { primary: string; background: string; text: string; font?: string; radius?: string }
const HEX = /^#[0-9a-f]{6}$/i;
export function appearance(b: Brand) {
  const ok = (v: string, d: string) => (HEX.test(v) ? v : d);
  return { theme: 'flat' as const, variables: { colorPrimary: ok(b.primary, '#1b2410'), colorBackground: ok(b.background, '#ffffff'), colorText: ok(b.text, '#1b2410'), colorDanger: '#b3261e', fontFamily: b.font ?? 'system-ui, sans-serif', borderRadius: b.radius ?? '12px', spacingUnit: '4px' },
    rules: { '.Input': { padding: '14px', border: '1px solid rgba(0,0,0,.16)', boxShadow: 'none' }, '.Input:focus': { borderColor: ok(b.primary, '#1b2410'), boxShadow: `0 0 0 3px ${ok(b.primary, '#1b2410')}33` }, '.Label': { fontWeight: '550' } } };
}
