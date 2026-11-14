import 'server-only';
import type { CommerceGateway } from './gateway';
import { demoGateway } from './demo';

/** Single place to choose the adapter. A real HttpGateway validates session, membership, store and operation per call. */
export function gateway(): CommerceGateway {
  if (process.env.OSS_GATEWAY_URL) throw new Error('HttpGateway not implemented: cell API does not exist yet. Unset OSS_GATEWAY_URL to use demo data.');
  return demoGateway;
}
