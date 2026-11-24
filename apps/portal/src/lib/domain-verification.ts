import { resolve4, resolveCname } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface DomainVerificationPort { check(host: string): Promise<boolean> }
export interface DnsResolver {
  cname(host: string): Promise<string[]>;
  ipv4(host: string): Promise<string[]>;
}

export const VERCEL_CNAME = 'cname.vercel-dns.com';
export const VERCEL_IPV4 = '76.76.21.21';

export function validPublicHost(host: string): boolean {
  return isIP(host) === 0 && host.length <= 253 && host === host.toLowerCase() && !host.endsWith('.') && !host.includes('..')
    && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)
    && !host.endsWith('.local') && !host.endsWith('.localhost');
}

export function liveDomainVerification(resolver: DnsResolver = { cname: resolveCname, ipv4: resolve4 }): DomainVerificationPort {
  return { async check(host) {
    if (!validPublicHost(host)) return false;
    const [cnames, addresses] = await Promise.all([
      resolver.cname(host).catch((): string[] => []),
      resolver.ipv4(host).catch((): string[] => []),
    ]);
    return cnames.some(value => value.toLowerCase().replace(/\.$/, '') === VERCEL_CNAME)
      || addresses.includes(VERCEL_IPV4);
  } };
}
