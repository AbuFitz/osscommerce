import { createHash, randomBytes } from 'node:crypto';
import { ExternalError, type EnvVar, type HostingPort, type RegistryPort, type Env } from './ports.ts';

export interface ProvisionInput { runId: string; storeId: string; storefrontId: string; env: Env; projectName: string; apiUrl: string; siteUrl: string; domain?: string; credentialDays?: number; extraPublic?: Record<string, string> }
export type StepResult = { step: string; status: 'done' | 'skipped' | 'failed'; retryable?: boolean; message?: string };
export const STEPS = ['project', 'credentials_and_env', 'domain', 'domain_verified'] as const;

const secret = () => randomBytes(32).toString('base64url');      // 256 bits, 43 chars
const sha = (s: string) => createHash('sha256').update(s).digest();
const targetsFor = (e: Env): EnvVar['targets'] => (e === 'production' ? ['production'] : e === 'development' ? ['development'] : ['preview']);

/** Safe to run again after any failure. Each step records its outcome; a re-run skips finished steps and adopts what a half-finished
 *  step already created at the provider (a project that exists is reused, not duplicated). Secrets exist only in memory inside one step
 *  and are written straight to the host as sensitive variables: they are never logged, ledgered, returned, or put in an error. */
export async function provision(i: ProvisionInput, host: HostingPort, reg: RegistryPort): Promise<StepResult[]> {
  const out: StepResult[] = []; let projectId: string | undefined;
  const run = async (step: string, fn: () => Promise<string | undefined | void>) => {
    const prior = await reg.getStep(i.runId, step);
    if (prior?.status === 'done') { if (step === 'project') projectId = prior.externalId; out.push({ step, status: 'skipped' }); return true; }
    await reg.saveStep(i.runId, step, { status: 'running' });
    try { const ext = await fn(); await reg.saveStep(i.runId, step, { status: 'done', externalId: ext ?? undefined }); await reg.audit({ runId: i.runId, storeId: i.storeId, step, outcome: 'done' }); if (step === 'project') projectId = ext ?? undefined; out.push({ step, status: 'done' }); return true; }
    catch (e) {
      const retryable = e instanceof ExternalError ? e.retryable : false; const message = e instanceof ExternalError ? e.message : 'Unexpected error';
      await reg.saveStep(i.runId, step, { status: 'failed', error: message }); await reg.audit({ runId: i.runId, storeId: i.storeId, step, outcome: 'failed', detail: message });
      out.push({ step, status: 'failed', retryable, message }); return false;
    }
  };
  if (!await run('project', async () => (await host.findProject(i.projectName) ?? await host.createProject({ name: i.projectName, framework: 'nextjs' })).id)) return out;
  if (!await run('credentials_and_env', async () => {
    // A retry may arrive after secrets were issued but before they reached the host. They cannot be recovered (only hashes exist), so rotate.
    await reg.revokeCredentials(i.storefrontId);
    const server = secret(), reval = secret(), expiresAt = new Date(Date.now() + (i.credentialDays ?? 365) * 86400_000);
    await reg.createCredentials(i.storefrontId, [{ purpose: 'server', hash: sha(server), prefix: server.slice(0, 6), expiresAt }, { purpose: 'revalidation', hash: sha(reval), prefix: reval.slice(0, 6), expiresAt }]);
    const t = targetsFor(i.env);
    await host.upsertEnv(projectId!, [
      { key: 'OSS_COMMERCE_API_URL', value: i.apiUrl, sensitive: false, targets: t }, { key: 'OSS_STORE_ID', value: i.storeId, sensitive: false, targets: t }, { key: 'OSS_STOREFRONT_ID', value: i.storefrontId, sensitive: false, targets: t },
      { key: 'OSS_ENV', value: i.env, sensitive: false, targets: t }, { key: 'OSS_SITE_URL', value: i.siteUrl, sensitive: false, targets: t },
      { key: 'OSS_STOREFRONT_SERVER_SECRET', value: server, sensitive: true, targets: t }, { key: 'OSS_REVALIDATION_SECRET', value: reval, sensitive: true, targets: t },
      ...Object.entries(i.extraPublic ?? {}).map(([key, value]) => ({ key, value, sensitive: false, targets: t })),
    ]);
  })) return out;
  if (i.domain) {
    if (!await run('domain', async () => { await host.addDomain(projectId!, i.domain!); })) return out;
    if (!await run('domain_verified', async () => { const v = await host.verifyDomain(projectId!, i.domain!); if (!v.verified) throw new ExternalError('DNS not verified yet. Point the records at Vercel and retry.', true); })) return out;
  }
  await reg.setStorefrontState(i.storefrontId, 'connected');
  return out;
}

export function nextAction(results: StepResult[]): 'done' | 'retry' | 'fix' {
  const f = results.find(r => r.status === 'failed'); return !f ? 'done' : f.retryable ? 'retry' : 'fix';
}
