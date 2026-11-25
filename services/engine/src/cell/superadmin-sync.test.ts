// The operator's sign-in follows the environment: a rotated password works, the old one stops working, and nothing else is touched.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path'; import fs from 'node:fs';
import { mergeConfig, PasswordCipher, TransactionalConnection, AdministratorService, RequestContextService, RoleService } from '@vendure/core';
import { createTestEnvironment, testConfig, SqljsInitializer, registerInitializer } from '@vendure/testing';
import { User } from '@vendure/core';
import { syncSuperadmin } from './superadmin-sync.ts';
import { engineLogin } from '../../../../apps/portal/src/lib/engine/exec.ts';

const dir = path.join(__dirname, '.tmp-superadmin'); fs.mkdirSync(dir, { recursive: true }); registerInitializer('sqljs', new SqljsInitializer(dir));
const { server } = createTestEnvironment(mergeConfig(testConfig, { authOptions: { requireVerification: false, tokenMethod: 'bearer', superadminCredentials: { identifier: 'operator', password: 'first-long-password-1' } } }));
const URL = `http://localhost:${testConfig.apiOptions.port}/${testConfig.apiOptions.adminApiPath}`;
before(async () => { await server.init({ initialData: { defaultLanguage: 'en', defaultZone: 'UK', countries: [{ name: 'United Kingdom', code: 'GB', zone: 'UK' }], taxRates: [{ name: 'Standard', percentage: 20 }], shippingMethods: [], paymentMethods: [], collections: [] } as any, productsCsvPath: path.join(__dirname, '../../proofs/empty.csv') }); });
after(async () => { await server.destroy(); fs.rmSync(dir, { recursive: true, force: true }); });
const opCtx = async (identifier: string) => { const user = await server.app.get(TransactionalConnection).rawConnection.getRepository(User).findOneOrFail({ where: { identifier }, relations: ['roles', 'roles.channels'] }); return server.app.get(RequestContextService).create({ apiType: 'admin', user }); };
const sync = (id: string, pw: string) => syncSuperadmin(server.app.get(TransactionalConnection), server.app.get(PasswordCipher), id, pw);

test('unchanged credentials change nothing', async () => { assert.deepEqual(await sync('operator', 'first-long-password-1'), { identifier: false, password: false, retired: [] }); assert.ok(await engineLogin({ url: URL }, 'operator', 'first-long-password-1')); });
test('a rotated password takes effect and the old one stops working', async () => {
  assert.deepEqual(await sync('operator', 'second-long-password-2'), { identifier: false, password: true, retired: [] });
  assert.ok(await engineLogin({ url: URL }, 'operator', 'second-long-password-2'), 'new password works'); assert.equal(await engineLogin({ url: URL }, 'operator', 'first-long-password-1'), null, 'old password is refused');
});
test('a rotated username takes effect too', async () => {
  assert.deepEqual(await sync('platform-operator', 'second-long-password-2'), { identifier: true, password: false, retired: [] });
  assert.ok(await engineLogin({ url: URL }, 'platform-operator', 'second-long-password-2')); assert.equal(await engineLogin({ url: URL }, 'operator', 'second-long-password-2'), null);
});

test('the case that bit us: a changed username makes a second operator, and syncing retires the old one so its password stops working', async () => {
  // What Vendure does on first boot with a new SUPERADMIN_USER: a second super admin appears next to the first.
  const admins = server.app.get(AdministratorService), roles = server.app.get(RoleService); const ctx = await opCtx('platform-operator');
  const sa = (await roles.getSuperAdminRole(ctx)); await admins.create(ctx, { emailAddress: 'new-operator', firstName: 'N', lastName: 'O', password: 'third-long-password-3', roleIds: [sa.id] });
  assert.ok(await engineLogin({ url: URL }, 'platform-operator', 'second-long-password-2'), 'both work before the sync');
  const r = await sync('new-operator', 'third-long-password-3'); assert.deepEqual(r, { identifier: false, password: false, retired: ['platform-operator'] });
  assert.equal(await engineLogin({ url: URL }, 'platform-operator', 'second-long-password-2'), null, 'the old operator is gone'); assert.ok(await engineLogin({ url: URL }, 'new-operator', 'third-long-password-3'), 'the one in the environment works');
  assert.deepEqual(await sync('new-operator', 'third-long-password-3'), { identifier: false, password: false, retired: [] }, 'and a second start changes nothing');
});
test('with several operators and none matching, it refuses to guess', async () => {
  const admins = server.app.get(AdministratorService), roles = server.app.get(RoleService); const ctx = await opCtx('new-operator'); const sa = await roles.getSuperAdminRole(ctx);
  await admins.create(ctx, { emailAddress: 'another-operator', firstName: 'A', lastName: 'O', password: 'fourth-long-password-4', roleIds: [sa.id] });
  await assert.rejects(sync('nobody', 'x-long-password-5'), /none is named like/);
});

test('merchant roles are brought up to date; the operator and unrelated roles are left alone', async () => {
  const { syncMerchantRoles } = await import('./role-sync.ts'); const { Role, Permission } = await import('@vendure/core'); const { permissionsForRoleCode } = await import('./merchant-role.ts'); const repo = server.app.get(TransactionalConnection).rawConnection.getRepository(Role);
  await repo.save(repo.create({ code: 'owner-x', description: 'old store', permissions: [Permission.ReadCatalog] })); await repo.save(repo.create({ code: 'staff-reader', description: 'someone else', permissions: [Permission.ReadCatalog] })); await repo.save(repo.create({ code: 'manager-x', description: 'old manager', permissions: [Permission.ReadCatalog] }));
  const ch = await syncMerchantRoles(server.app.get(TransactionalConnection)); assert.deepEqual(ch.sort(), ['manager-x', 'owner-x']);
  assert.deepEqual([...(await repo.findOneByOrFail({ code: 'owner-x' })).permissions].sort(), [...permissionsForRoleCode('owner-x')!].sort()); assert.ok((await repo.findOneByOrFail({ code: 'owner-x' })).permissions.includes(Permission.Authenticated), 'owners keep the baseline Authenticated permission'); assert.ok((await repo.findOneByOrFail({ code: 'manager-x' })).permissions.includes(Permission.Authenticated) && !(await repo.findOneByOrFail({ code: 'manager-x' })).permissions.includes('ManageStaff' as never), 'a manager carries the baseline but never the staff-management power'); assert.deepEqual((await repo.findOneByOrFail({ code: 'staff-reader' })).permissions, [Permission.ReadCatalog]);
  assert.deepEqual(await syncMerchantRoles(server.app.get(TransactionalConnection)), [], 'a second pass changes nothing');
});
