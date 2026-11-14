import 'server-only';
import type { CommerceGateway } from './gateway';
import { demoGateway } from './demo';
import { DEMO } from './env';

/** Single place to choose the adapter. Fails closed: no gateway and no demo flag means no data, never silent fixtures. */
export function gateway(): CommerceGateway {
  // Production must never serve fixtures, even if the flag leaks into its build.
  if (DEMO && process.env.APP_ENV === 'production') throw new Error('NEXT_PUBLIC_OSS_DEMO must not be set in production.');
  if (DEMO) return demoGateway;
  // A real HttpGateway validates session, membership, store and operation per call. Not built yet.
  throw new Error('Commerce gateway is not configured. Set OSS_GATEWAY_URL once the cell API exists, or NEXT_PUBLIC_OSS_DEMO=1 for demo data.');
}
