"""Regenerates src/lib/marks.ts from the payment-icons package: npm pack payment-icons; extract; point BASE at package/svg/single."""
import base64, re, sys
BASE = sys.argv[1] if len(sys.argv) > 1 else 'package/svg/single'
out = {}
for n in ['visa', 'mastercard', 'amex', 'paypal']:
    s = open(f'{BASE}/{n}.svg').read()
    s = re.sub(r'<\?xml[^>]*\?>', '', s); s = re.sub(r'<metadata>.*?</metadata>', '', s, flags=re.S); s = re.sub(r'<!--.*?-->', '', s, flags=re.S); s = re.sub(r'\s+', ' ', s).strip()
    out[n] = 'data:image/svg+xml;base64,' + base64.b64encode(s.encode()).decode()
print('export const CARD_LOGOS: Record<string, string> = {'); [print(f"  {k}: '{v}',") for k, v in out.items()]; print('};')
