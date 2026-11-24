import 'server-only';
import type { CommerceGateway } from './gateway';
import { demoGateway } from './demo';
import { DEMO } from './env';
import { engineGateway } from './engine/gateway';
import { LIVE, sessionExec } from './session';
import { controlPlaneFromEnv } from './control-plane';

/**
 * Single place to choose the adapter. Fails closed:
 * - ENGINE_ADMIN_URL set: the live engine, with the signed-in merchant's own session. Demo data is never mixed in.
 * - otherwise demo fixtures only when NEXT_PUBLIC_OSS_DEMO=1, and never in production.
 */
export function gateway(): CommerceGateway {
  if (LIVE) return engineGateway(sessionExec, { storeId: process.env.STORE_ID ?? 'store', name: process.env.STORE_NAME ?? 'Your store', host: process.env.STORE_HOST }, controlPlaneFromEnv());
  if (DEMO && process.env.APP_ENV === 'production') throw new Error('NEXT_PUBLIC_OSS_DEMO must not be set in production.');
  if (DEMO) return demoGateway;
  throw new Error('Commerce engine is not configured. Set ENGINE_ADMIN_URL, or NEXT_PUBLIC_OSS_DEMO=1 for demo data.');
}
