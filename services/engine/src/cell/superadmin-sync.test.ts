// The operator's sign-in follows the environment: a rotated password works, the old one stops working, and nothing else is touched.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig, PasswordCipher, TransactionalConnection } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { syncSuperadmin } from './superadmin-sync.ts';
import { engineLogin } from '../../../../apps/portal/src/lib/engine/exec.ts';

const dir = path.join(__dirname, '.tmp-superadmin'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const { server } = createTestEnvironment(mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'operator', password: 'first-long-password-1' } } }));
const URL = `http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`;
before(async () => { await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv') }); });
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });
const sync = (id: string, pw: string) => syncSuperadmin(server.app.get(TransactionalConnection), server.app.get(PasswordCipher), id, pw);

test('unchanged credentials change nothing', async () => { assert.deepEqual(await sync('operator', 'first-long-password-1'), { identifier: false, password: false }); assert.ok(await engineLogin({ url: URL }, 'operator', 'first-long-password-1')); });
test('a rotated password takes effect and the old one stops working', async () => {
  assert.deepEqual(await sync('operator', 'second-long-password-2'), { identifier: false, password: true });
  assert.ok(await engineLogin({ url: URL }, 'operator', 'second-long-password-2'), 'new password works'); assert.equal(await engineLogin({ url: URL }, 'operator', 'first-long-password-1'), null, 'old password is refused');
});
test('a rotated username takes effect too', async () => {
  assert.deepEqual(await sync('platform-operator', 'second-long-password-2'), { identifier: true, password: false });
  assert.ok(await engineLogin({ url: URL }, 'platform-operator', 'second-long-password-2')); assert.equal(await engineLogin({ url: URL }, 'operator', 'second-long-password-2'), null);
});
