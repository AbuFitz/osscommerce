import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRuntimeRole } from './runtime.ts';

const pool = (row: Record<string, unknown> | undefined) => ({ query: async () => ({ rows: row ? [row] : [] }) }) as any;
test('runtime role must inherit oss_runtime without owning the schema tables', async () => {
  await assert.doesNotReject(assertRuntimeRole(pool({ current_user: 'gateway_runtime', runtime_member: true, table_owner: 'schema_owner' })));
  await assert.rejects(assertRuntimeRole(pool({ current_user: 'gateway_runtime', runtime_member: false, table_owner: 'schema_owner' })), /inherit oss_runtime/);
  await assert.rejects(assertRuntimeRole(pool({ current_user: 'schema_owner', runtime_member: true, table_owner: 'schema_owner' })), /must not own/);
  await assert.rejects(assertRuntimeRole(pool(undefined)), /not migrated/);
});
