import assert from 'node:assert/strict';
import test from 'node:test';
import { liveDomainVerification, validPublicHost } from './domain-verification.ts';

test('domain verification accepts only the platform CNAME or IPv4 target', async () => {
  const resolver = (cname: string[] = [], ipv4: string[] = []) => ({ cname: async () => cname, ipv4: async () => ipv4 });
  assert.equal(await liveDomainVerification(resolver(['cname.vercel-dns.com.'])).check('shop.example.co.uk'), true);
  assert.equal(await liveDomainVerification(resolver([], ['76.76.21.21'])).check('example.co.uk'), true);
  assert.equal(await liveDomainVerification(resolver(['other.vercel.app'], ['203.0.113.10'])).check('shop.example.co.uk'), false);
});

test('domain verification refuses malformed and local hosts before DNS', async () => {
  let calls = 0; const resolver = { cname: async () => { calls++; return []; }, ipv4: async () => { calls++; return []; } };
  for (const host of ['localhost', 'shop.localhost', 'UPPER.example', '127.0.0.1', '-bad.example', 'bad..example']) {
    assert.equal(validPublicHost(host), false);
    assert.equal(await liveDomainVerification(resolver).check(host), false);
  }
  assert.equal(calls, 0);
});
